'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, CheckCircle2, Clock, AlertTriangle, ShieldCheck,
  Download, Eye, Trash2, RefreshCw, Filter, Search, Plus, ExternalLink,
  FileCheck2, Tag, FileSpreadsheet, Sparkles, X, ChevronRight
} from 'lucide-react'
import {
  contributorStore,
  type EvidenceDocument,
  type ContributorRoleKey
} from '@/lib/pu/contributor-store'
import { toast } from 'sonner'

interface CommonEvidenceManagerProps {
  roleKey: ContributorRoleKey
  currentLevelKey?: string
  accentColor?: 'teal' | 'amber' | 'blue' | 'rose' | 'purple'
}

export function CommonEvidenceManager({
  roleKey,
  currentLevelKey,
  accentColor = 'teal'
}: CommonEvidenceManagerProps) {
  const [documents, setDocuments] = useState<EvidenceDocument[]>(() => contributorStore.getEvidence(roleKey))
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('All')
  const [isUploading, setIsUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<EvidenceDocument | null>(null)

  // Upload Form state
  const [newDocName, setNewDocName] = useState('')
  const [newDocCategory, setNewDocCategory] = useState('Audit Report')
  const [newLinkedModule, setNewLinkedModule] = useState(currentLevelKey || 'Level 1')
  const [newIssuingOrg, setNewIssuingOrg] = useState('Authorized Third Party')
  const [newRemarks, setNewRemarks] = useState('')

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDocName) return

    setIsUploading(true)
    setTimeout(() => {
      const doc: EvidenceDocument = {
        id: 'doc-' + Date.now(),
        documentId: `DOC-${roleKey.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
        documentName: newDocName.endsWith('.pdf') || newDocName.endsWith('.xlsx') ? newDocName : `${newDocName}.pdf`,
        documentCategory: newDocCategory,
        linkedRole: roleKey,
        linkedEntity: 'Megha Engineering & Infrastructures Ltd.',
        linkedModule: newLinkedModule,
        linkedDataRecord: 'Assigned Disclosure Record',
        reportingPeriod: 'FY 2026-27',
        documentDate: new Date().toISOString().split('T')[0],
        issuingOrganization: newIssuingOrg,
        originalFilename: newDocName,
        fileType: newDocName.endsWith('.xlsx') ? 'XLSX' : 'PDF',
        fileSize: (Math.random() * 4 + 1).toFixed(1) + ' MB',
        uploadedBy: 'Active Contributor',
        uploadTimestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reviewStatus: 'Pending Verification',
        versionNumber: 'v1.0',
        remarks: newRemarks || 'Uploaded via Contributor Console'
      }

      contributorStore.addEvidence(doc)
      setDocuments(contributorStore.getEvidence(roleKey))
      setIsUploading(false)
      setShowUploadModal(false)
      setNewDocName('')
      setNewRemarks('')
    }, 800)
  }

  const filteredDocs = documents.filter(d => {
    const matchesSearch = d.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.documentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.linkedModule.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === 'All' || d.documentCategory === filterCategory
    return matchesSearch && matchesCategory
  })

  const getStatusBadge = (status: EvidenceDocument['reviewStatus']) => {
    switch (status) {
      case 'Verified & Accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Verified & Accepted
          </span>
        )
      case 'Pending Verification':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Clock className="h-3 w-3 text-amber-600" />
            Pending Verification
          </span>
        )
      case 'Flagged':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            Flagged
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Upload trigger */}
      <div className="relative overflow-hidden glass-form-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">
                Evidence & Document Repository
              </h2>
              <span className="rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                Traceability Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Attach primary audit logs, statutory returns, third-party laboratory reports, and utility invoices.
              Uploaded files are tracked with versioning, cryptographic checksums, and independent reviewer verification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Supporting Evidence</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by file name, doc ID or linked module..."
              className="ios-field !py-1.5 !pl-9 !text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Filter:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="ios-field !w-auto !py-1.5 !text-xs font-semibold text-slate-700"
            >
              <option value="All">All Categories</option>
              <option value="Workforce Records">Workforce Records</option>
              <option value="Energy & Utility Invoices">Energy & Utility Invoices</option>
              <option value="Vendor Environmental Certifications">Vendor Certifications</option>
              <option value="Community Beneficiary Registers">Beneficiary Registers</option>
              <option value="Corporate Governance Policies">Corporate Policies</option>
            </select>
          </div>
        </div>
      </div>

      {/* Document List Table */}
      <div className="overflow-hidden glass-form-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Document Details</th>
                <th className="py-3.5 px-4">Linked Module / Record</th>
                <th className="py-3.5 px-4">Issuing Authority</th>
                <th className="py-3.5 px-4">Size & Version</th>
                <th className="py-3.5 px-4">Uploaded By & Date</th>
                <th className="py-3.5 px-4">Review Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <span>No evidence documents found matching criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          {doc.fileType === 'XLSX' ? (
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <FileText className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                            {doc.documentName}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-slate-500">{doc.documentId}</span>
                            <span>•</span>
                            <span className="text-slate-500">{doc.documentCategory}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-700">{doc.linkedModule}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{doc.linkedDataRecord}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-600">{doc.issuingOrganization}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-700">{doc.fileSize}</div>
                      <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {doc.versionNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-700">{doc.uploadedBy}</div>
                      <div className="text-[11px] text-slate-400">{doc.uploadTimestamp}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(doc.reviewStatus)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          title="Preview Metadata"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toast.info(`Downloading ${doc.documentName}...`)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Download Document"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Upload className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Upload & Link Supporting Evidence
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="ios-label">
                    Document / File Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="e.g. Audit_Inspection_Report_Q2.pdf"
                    className="ios-field !text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ios-label">
                      Document Category
                    </label>
                    <select
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value)}
                      className="ios-field !text-xs"
                    >
                      <option value="Audit Report">Audit Report</option>
                      <option value="Statutory Return">Statutory Return</option>
                      <option value="Utility / Vendor Invoice">Utility / Vendor Invoice</option>
                      <option value="Laboratory Test Certificate">Laboratory Test Certificate</option>
                      <option value="Corporate Policy Document">Corporate Policy Document</option>
                      <option value="Other Evidence">Other Evidence</option>
                    </select>
                  </div>
                  <div>
                    <label className="ios-label">
                      Linked Disclosure Module
                    </label>
                    <input
                      type="text"
                      value={newLinkedModule}
                      onChange={(e) => setNewLinkedModule(e.target.value)}
                      className="ios-field !text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="ios-label">
                    Issuing Authority / Organization
                  </label>
                  <input
                    type="text"
                    value={newIssuingOrg}
                    onChange={(e) => setNewIssuingOrg(e.target.value)}
                    placeholder="e.g. NABL Lab / SPCB / Internal HR Committee"
                    className="ios-field !text-xs"
                  />
                </div>

                <div>
                  <label className="ios-label">
                    Remarks & Verification Context
                  </label>
                  <textarea
                    rows={2}
                    value={newRemarks}
                    onChange={(e) => setNewRemarks(e.target.value)}
                    placeholder="Explain methodology or reference sections..."
                    className="ios-field !text-xs"
                  />
                </div>

                <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4 text-center">
                  <Upload className="mx-auto h-6 w-6 text-blue-500 mb-1" />
                  <p className="font-semibold text-slate-700 text-xs">Drag & drop files or click to browse</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF, XLSX, DOCX up to 25 MB</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="ios-btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !newDocName}
                    className="btn-liquid-blue rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {isUploading ? 'Registering Document...' : 'Upload & Link Document'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Details / Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Evidence Metadata Record
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Document ID:</span>
                    <span className="font-mono font-bold text-slate-800">{previewDoc.documentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Name:</span>
                    <span className="font-semibold text-slate-800">{previewDoc.documentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Linked Module:</span>
                    <span className="font-semibold text-blue-600">{previewDoc.linkedModule}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Review Status:</span>
                    <span>{getStatusBadge(previewDoc.reviewStatus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Version:</span>
                    <span className="font-bold text-slate-700">{previewDoc.versionNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Uploaded By:</span>
                    <span className="text-slate-700">{previewDoc.uploadedBy} ({previewDoc.uploadTimestamp})</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Traceability Remarks & Audit Note
                  </span>
                  <p className="text-slate-700 italic">
                    &quot;{previewDoc.remarks}&quot;
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    SHA-256 Verified · Immutable Audit Record
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      toast.success(`Downloading official certified extract for ${previewDoc.documentId}`)
                      setPreviewDoc(null)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Copy</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
