'use client'

import { useState, useRef, useMemo } from 'react'
import { FileText, CheckCircle2, Clock, Link2, Check, Upload, Download, Eye, FileSpreadsheet, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { type EvidenceItem, useApiBase } from './core'
import { OcrScanButton, type OcrFields } from './ocr-scan'

/* ============================================================
   IN-FORM EVIDENCE ATTACH SECTION (AFTER REMARKS)
   Upload + attach stored evidence documents directly inside the
   level form, right before saving — mirrors the Engine Preview
   panel's repository so both stay in sync.
   ============================================================ */

export interface FormEvidenceAttachSectionProps {
  projectId: string
  periodId: string
  moduleKey: string
  evidence: EvidenceItem[]
  onUploaded: () => Promise<void>
  selectedEvidenceId?: string | null
  onSelectEvidence?: (id: string | null) => void
  selectedEvidenceIds?: string[]
  onSelectEvidenceIds?: (ids: string[]) => void
  onReview?: (ev: EvidenceItem) => void
  readOnly: boolean
  /** Gemini OCR: confirmed extracted fields handed to the level form. */
  onOcrApply?: (fields: OcrFields) => void
}

export function FormEvidenceAttachSection({
  projectId,
  periodId,
  moduleKey,
  evidence,
  onUploaded,
  selectedEvidenceId,
  onSelectEvidence,
  selectedEvidenceIds,
  onSelectEvidenceIds,
  onReview,
  readOnly,
  onOcrApply,
}: FormEvidenceAttachSectionProps) {
  const apiBase = useApiBase()

  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derive active attached IDs (combining single and array props)
  const activeIds = useMemo(() => {
    if (selectedEvidenceIds !== undefined) return selectedEvidenceIds
    if (selectedEvidenceId) return [selectedEvidenceId]
    return []
  }, [selectedEvidenceIds, selectedEvidenceId])

  const attachedList = useMemo(() => {
    return evidence.filter((ev) => activeIds.includes(ev.id))
  }, [evidence, activeIds])

  const toggleEvidence = (evId: string) => {
    if (readOnly) return
    const isSelected = activeIds.includes(evId)
    const nextIds = isSelected ? activeIds.filter((id) => id !== evId) : [...activeIds, evId]

    if (onSelectEvidenceIds) {
      onSelectEvidenceIds(nextIds)
    }
    if (onSelectEvidence) {
      onSelectEvidence(nextIds.length > 0 ? nextIds[nextIds.length - 1] : null)
    }
  }

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0 || readOnly) return
    setUploading(true)
    const toastId = toast.loading(`Uploading ${fileList.length} evidence document(s)...`)
    try {
      const newIds: string[] = []
      let lastUploaded: EvidenceItem | null = null

      for (const file of fileList) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('documentType', 'INVOICE')
        fd.append('module', moduleKey)
        if (projectId) fd.append('projectId', projectId)
        if (periodId) fd.append('periodId', periodId)

        const res = await fetch(`${apiBase}/evidence`, { method: 'POST', body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `Failed to upload ${file.name}`)
        }
        const uploaded = await res.json()
        if (uploaded?.id) {
          newIds.push(uploaded.id)
          lastUploaded = uploaded
        }
      }

      toast.success(`${fileList.length} document(s) uploaded & verified!`, {
        id: toastId,
        description: 'Stored in Evidence Vault (SHA-256 hash created) and attached below.',
      })
      await onUploaded()

      if (newIds.length > 0) {
        const combined = Array.from(new Set([...activeIds, ...newIds]))
        if (onSelectEvidenceIds) {
          onSelectEvidenceIds(combined)
        }
        if (onSelectEvidence) {
          onSelectEvidence(combined[combined.length - 1])
        }
        if (lastUploaded && onReview) {
          onReview(lastUploaded)
        }
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

  return (
    <div className="rounded-xl border border-violet-200/80 bg-gradient-to-b from-violet-50/70 to-white/80 p-3 shadow-sm">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-violet-600">
            <Link2 className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            Attach Evidence Documents (Multiple Allowed)
          </span>
        </div>
        <span className={`status-pill ${attachedList.length > 0 ? 'status-approved' : 'status-draft'}`}>
          {attachedList.length > 0 ? `${attachedList.length} Attached` : 'Optional'}
        </span>
      </div>

      {/* Currently attached documents deck */}
      {attachedList.length > 0 && (
        <div className="mb-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Attached Documents ({attachedList.length})
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  if (onSelectEvidenceIds) onSelectEvidenceIds([])
                  if (onSelectEvidence) onSelectEvidence(null)
                }}
                className="text-[9px] font-bold text-rose-600 hover:underline"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {attachedList.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white/95 px-2 py-1 text-xs text-slate-800 shadow-2xs"
              >
                {att.fileName.match(/\.pdf$/i) ? (
                  <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                ) : att.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                  <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                )}
                <span className="max-w-[150px] truncate text-[11px] font-semibold" title={att.fileName}>
                  {att.fileName}
                </span>
                {onReview && (
                  <button
                    type="button"
                    onClick={() => onReview(att)}
                    className="flex h-5 w-5 items-center justify-center rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    title="Review document (flips Engine Preview card 180°)"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => toggleEvidence(att.id)}
                    className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    title="Detach document"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload dropzone (multiple allowed) + AI scan */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files)
        }}
        onClick={() => !readOnly && !uploading && fileInputRef.current?.click()}
        className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center transition-all ${
          readOnly
            ? 'cursor-not-allowed border-slate-200 bg-slate-50/60 opacity-60'
            : dragActive
            ? 'cursor-pointer border-violet-500 bg-violet-50/80 scale-[1.01]'
            : 'cursor-pointer border-slate-200/90 bg-white/80 hover:border-violet-400 hover:bg-violet-50/40'
        }`}
      >
        <div role="presentation" className="flex items-center justify-between gap-2 self-end -mb-1" onClick={(e) => e.stopPropagation()}>
          {!readOnly && onOcrApply && (
            <OcrScanButton apiBase={apiBase} onApply={onOcrApply} disabled={uploading} />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
          disabled={readOnly}
          onChange={(e) => {
            if (e.target.files?.length) handleUploadFiles(e.target.files)
          }}
        />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition-transform group-hover:scale-110">
          {uploading ? (
            <Clock className="h-3.5 w-3.5 animate-spin text-violet-600" />
          ) : (
            <Upload className="h-3.5 w-3.5 text-violet-600" />
          )}
        </div>
        <div className="mt-1 text-[11px] font-bold text-slate-800">
          {uploading ? 'Processing & hashing file(s)…' : 'Upload document(s) for this record (Multi-file enabled)'}
        </div>
        <div className="text-[9px] text-slate-500">
          Select single or multiple files · PDF, PNG, JPG, XLSX, CSV (Max 25MB · SHA-256 tamper-evident)
        </div>
      </div>

      {/* Stored evidence cards — attach / review / download */}
      {evidence.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Or pick from Evidence Vault ({evidence.length})
          </div>
          <div className="max-h-44 space-y-1.5 overflow-y-auto scroll-elegant pr-0.5">
            {evidence.map((ev) => {
              const isSelected = activeIds.includes(ev.id)
              return (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between rounded-xl border p-2 text-xs transition-all ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50/90 shadow-xs'
                      : 'border-slate-200/80 bg-white/90 hover:bg-violet-50/30'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      {ev.fileName.match(/\.pdf$/i) ? (
                        <FileText className="h-3.5 w-3.5 text-rose-500" />
                      ) : ev.fileName.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold text-slate-800" title={ev.fileName}>
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

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleEvidence(ev.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
                      title={isSelected ? 'Detach this evidence from the record' : 'Attach this evidence to the record'}
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Attached</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3 w-3" />
                          <span>Attach</span>
                        </>
                      )}
                    </button>

                    {onReview && (
                      <button
                        type="button"
                        onClick={() => onReview(ev)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                        title="Review document (flips Engine Preview card)"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    )}

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

      {evidence.length === 0 && (
        <p className="mt-1.5 text-[10px] text-slate-500">
          No documents in the vault for this project yet — upload the source document above after filling the form.
        </p>
      )}
    </div>
  )
}