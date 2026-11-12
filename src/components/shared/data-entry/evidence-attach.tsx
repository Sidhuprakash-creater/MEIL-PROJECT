'use client'

import { useState, useRef, useMemo } from 'react'
import { FileText, CheckCircle2, Clock, Link2, Check, Upload, Download, Eye, FileSpreadsheet, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { type EvidenceItem, useApiBase } from './core'
import { OcrScanButton, type OcrFields } from './ocr-scan'
import { EvidenceSecurityNotice } from '@/components/shared/evidence/evidence-security-notice'
import { uploadEvidenceFile, type DuplicateInfo, type UploadRejection } from '@/lib/evidence/upload-client'
import { MultiEvidenceGallery } from '@/components/shared/multi-evidence-gallery'

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
  /**
   * Evidence ids already attached to ANOTHER source item of this record, with
   * the name of that source. One document may back only one source — the UI
   * says so instead of silently attaching the same file twice.
   */
  evidenceUsedElsewhere?: Record<string, string>
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
  evidenceUsedElsewhere,
}: FormEvidenceAttachSectionProps) {
  const apiBase = useApiBase()

  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [rejection, setRejection] = useState<UploadRejection | null>(null)
  const [retryFile, setRetryFile] = useState<File | null>(null)
  const [showGallery, setShowGallery] = useState(false)
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
    /* Block attaching a document that already backs another source item of
       this record — one document, one source. */
    const usedBy = evidenceUsedElsewhere?.[evId];
    if (!isSelected && usedBy) {
      toast.warning('Evidence already used by another source', {
        description: `“${evidence.find((e) => e.id === evId)?.fileName ?? "This document"}” is already attached to ${usedBy}. A document can support only one source per record.`,
      })
      return
    }
    const nextIds = isSelected ? activeIds.filter((id) => id !== evId) : [...activeIds, evId]

    if (onSelectEvidenceIds) {
      onSelectEvidenceIds(nextIds)
    }
    if (onSelectEvidence) {
      onSelectEvidence(nextIds.length > 0 ? nextIds[nextIds.length - 1] : null)
    }
  }

  const uploadOne = async (file: File, allowDuplicate = false): Promise<EvidenceItem | null> => {
    const outcome = await uploadEvidenceFile({
      apiBase,
      file,
      allowDuplicate,
      fields: {
        documentType: 'INVOICE',
        module: moduleKey,
        projectId: projectId || undefined,
        periodId: periodId || undefined,
      },
    })
    if (!outcome.ok) {
      setRejection(outcome.rejection)
      setRetryFile(file)
      return null
    }
    setRejection(null)
    setRetryFile(null)
    const data = outcome.data as { id?: string } & EvidenceItem
    return data
  }

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0 || readOnly) return
    setUploading(true)
    setRejection(null)
    const toastId = toast.loading(`Uploading ${fileList.length} evidence document(s)...`)
    try {
      const newIds: string[] = []
      let lastUploaded: EvidenceItem | null = null
      let uploadedCount = 0

      for (const file of fileList) {
        const uploaded = await uploadOne(file)
        if (!uploaded) continue
        uploadedCount++
        if (uploaded?.id) {
          newIds.push(uploaded.id)
          lastUploaded = uploaded
        }
      }

      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} document(s) uploaded & verified!`, {
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
      } else {
        toast.error('Upload rejected', {
          id: toastId,
          description: 'See the security notice below for details.',
        })
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

  /** The user confirmed the duplicate is intentional — file it as a new version. */
  const handleUploadAsNewVersion = async (_duplicate: DuplicateInfo) => {
    if (!retryFile) return
    setUploading(true)
    const toastId = toast.loading('Uploading as a new version...')
    try {
      const uploaded = await uploadOne(retryFile, true)
      if (uploaded?.id) {
        toast.success('Uploaded as a new version', { id: toastId })
        await onUploaded()
        if (onSelectEvidenceIds) {
          onSelectEvidenceIds(Array.from(new Set([...activeIds, uploaded.id])))
        }
        if (onSelectEvidence) onSelectEvidence(uploaded.id)
        if (onReview) onReview(uploaded)
      } else {
        toast.error('Upload rejected', { id: toastId })
      }
    } finally {
      setUploading(false)
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
            <div className="flex items-center gap-2">
              {attachedList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowGallery(true)}
                  className="flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-[9px] font-extrabold text-white shadow-2xs hover:bg-violet-700 transition active:scale-95"
                  title="View all attached evidence documents at once in sequence"
                >
                  <Eye className="h-2.5 w-2.5" /> View All ({attachedList.length})
                </button>
              )}
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
          Select single or multiple files · PDF, PNG, JPG, XLSX, CSV (Max 25MB · SHA-256 tamper-evident · malware-scanned)
        </div>
      </div>

      {/* Security scan / duplicate notice */}
      <EvidenceSecurityNotice
        rejection={rejection}
        busy={uploading}
        onUploadAsNewVersion={handleUploadAsNewVersion}
        onDismiss={() => {
          setRejection(null)
          setRetryFile(null)
        }}
      />

      {/* Stored evidence cards — attach / review / download */}
      {evidence.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Or pick from Evidence Vault ({evidence.length})
          </div>
          <div className="max-h-44 space-y-1.5 overflow-y-auto scroll-elegant pr-0.5">
            {evidence.map((ev) => {
              const isSelected = activeIds.includes(ev.id)
              const usedBy = evidenceUsedElsewhere?.[ev.id]
              return (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between rounded-xl border p-2 text-xs transition-all ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50/90 shadow-xs'
                      : usedBy
                        ? 'border-amber-200 bg-amber-50/50'
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
                        {usedBy && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-amber-700">used by {usedBy}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={readOnly || (!isSelected && !!usedBy)}
                      onClick={() => toggleEvidence(ev.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : usedBy
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
                      title={
                        isSelected
                          ? 'Detach this evidence from the record'
                          : usedBy
                            ? `Already attached to ${usedBy} — a document can support only one source per record`
                            : 'Attach this evidence to the record'
                      }
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Attached</span>
                        </>
                      ) : usedBy ? (
                        <>
                          <Link2 className="h-3 w-3" />
                          <span>In use</span>
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

      {showGallery && (
        <MultiEvidenceGallery
          documents={attachedList.map((att) => ({
            id: att.id,
            fileName: att.fileName,
            fileSize: att.fileSize,
            documentType: att.documentType,
            status: att.status,
            hash: att.hash,
            previewUrl: `${apiBase}/evidence/${encodeURIComponent(att.id)}/file`,
            downloadUrl: `${apiBase}/evidence/${encodeURIComponent(att.id)}/file?download=true`,
            uploadedAt: att.createdAt,
          }))}
          title="Attached Evidence Documents"
          subtitle="All attached documents in sequence — inspect proofs side-by-side or scroll together"
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  )
}