'use client'
/**
 * Evidence Module — Task 7-UI
 *
 * Evidence management screen for the MEIL ESG / BRSR Reporting Platform.
 * Lists evidence documents from GET /api/evidence with filters
 * (period / project / module / status) and exposes row actions:
 * Preview (sheet) · Verify (POST /verify) · Reject (POST /reject)
 * · Replace (demo) · History (audit trail fetch).
 *
 * Role-gated: verification is disabled while reviewer roles are removed
 * (see useRoleGate); everyone else gets upload + read-only views.
 * Premium light glass aesthetic per the established design system.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  FileText, Upload, Filter, RefreshCw, AlertOctagon, ShieldCheck, XCircle,
  History, Eye, CheckCircle2, Hash, Link2, User, Calendar, FileCheck2,
  FileType2, Building2, FolderOpen, ArrowRight, Inbox, Loader2, Info,
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// ---------- Types (mirror API response shapes) ----------

interface Uploader { id: string; name: string; email: string; employeeCode: string | null }

interface EvidenceItem {
  id: string
  fileName: string
  documentType: string
  documentDate: string | null
  reportingPeriodId: string | null
  projectId: string | null
  module: string | null
  sourceRecordId: string | null
  uploaderId: string
  filePath: string
  fileSize: number
  mimeType: string
  hash: string | null
  version: number
  status: string            // UPLOADED | UNDER_REVIEW | VERIFIED | REJECTED | REQUIRED | EXPIRED
  verificationComment: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
  uploader: Uploader
}

interface AuditLogRow {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  oldState: string | null
  newState: string | null
  reason: string | null
  createdAt: string
}

interface EvidenceDetail {
  evidence: EvidenceItem
  project: { id: string; projectCode: string; projectName: string; location: string | null } | null
  reportingPeriod: { id: string; periodLabel: string; year: number; month: number | null } | null
  linkedSourceRecord: Record<string, unknown> | null
  auditTrail: AuditLogRow[]
}

interface PeriodOption { id: string; label: string; year: number; month: number | null }
interface ProjectOption { id: string; code: string; name: string; location: string | null }

// Org tree shape from /api/organization/tree
interface OrgTreeResp {
  groups?: Array<{
    subsidiaries?: Array<{
      businessUnits?: Array<{
        projects?: Array<{ id: string; projectCode: string; projectName: string; location: string | null }>
      }>
    }>
  }>
}

// ---------- Constants ----------

const MODULE_OPTIONS = [
  { value: 'ENERGY', label: 'Energy' },
  { value: 'WATER', label: 'Water' },
  { value: 'WASTE', label: 'Waste' },
  { value: 'PEOPLE', label: 'People' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'TRAVEL', label: 'Travel' },
] as const

const STATUS_OPTIONS = [
  { value: 'UPLOADED', label: 'Uploaded' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'REQUIRED', label: 'Required' },
] as const

const DOC_TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  METER_READING: 'Meter Reading',
  WASTE_MANIFEST: 'Waste Manifest',
  POLICY: 'Policy',
  CERTIFICATE: 'Certificate',
  TRAINING_RECORD: 'Training Record',
  REGISTER: 'Register',
}

// ---------- Role helpers ----------

type RoleGate = {
  canVerify: boolean   // can verify/reject evidence
  canUpload: boolean  // can upload (project user side)
}

function useRoleGate(): RoleGate {
  const { user } = useApp()
  // Verifier roles (Group Admin / Reviewers) are currently removed — flip to
  // true for them here when those users are re-added.
  const canVerify = false
  // All authenticated users can upload evidence
  const canUpload = !!user
  return { canVerify, canUpload }
}

// ---------- Status pill mapping ----------

function statusPillClass(status: string): string {
  switch (status) {
    case 'VERIFIED': return 'status-verified'
    case 'UPLOADED': return 'status-draft'
    case 'UNDER_REVIEW': return 'status-review'
    case 'REJECTED': return 'status-error'
    case 'REQUIRED': return 'status-missing'
    case 'EXPIRED': return 'status-locked'
    case 'DRAFT': return 'status-draft'
    case 'SUBMITTED': return 'status-submitted'
    case 'BU_APPROVED':
    case 'SUBSIDIARY_APPROVED':
    case 'APPROVED': return 'status-approved'
    case 'UNDER_REVIEW_SUB': return 'status-review'
    case 'HQ_REVIEW': return 'status-review'
    case 'LOCKED': return 'status-locked'
    case 'CORRECTION_REQUESTED': return 'status-warning'
    case 'RESUBMITTED': return 'status-submitted'
    default: return 'status-draft'
  }
}

function statusLabel(status: string): string {
  return (status || '').split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function truncateHash(h: string | null | undefined): string {
  if (!h) return '—'
  return h.length <= 14 ? h : `${h.slice(0, 8)}…${h.slice(-4)}`
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ============================================================
// Main component
// ============================================================

export function EvidenceModule() {
  const { user } = useApp()
  const gate = useRoleGate()

  const [items, setItems] = useState<EvidenceItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])

  const [periodId, setPeriodId] = useState<string>('all')
  const [projectId, setProjectId] = useState<string>('all')
  const [moduleKey, setModuleKey] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<EvidenceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [verifyTarget, setVerifyTarget] = useState<EvidenceItem | null>(null)
  const [verifyComment, setVerifyComment] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)

  const [rejectTarget, setRejectTarget] = useState<EvidenceItem | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)

  // ----- fetch periods + projects (filters) -----
  useEffect(() => {
    fetch('/api/overview')
      .then(r => r.json())
      .then((d: { periods?: PeriodOption[] }) => {
        const ps: PeriodOption[] = (d.periods || []).map((p) => ({
          id: p.id, label: p.label, year: p.year, month: p.month,
        }))
        setPeriods(ps)
      })
      .catch(() => { /* silent — overview optional for filters */ })

    fetch('/api/organization/tree')
      .then(r => r.json())
      .then((d: OrgTreeResp) => {
        const out: ProjectOption[] = []
        for (const g of d.groups || []) {
          for (const s of g.subsidiaries || []) {
            for (const b of s.businessUnits || []) {
              for (const p of b.projects || []) {
                out.push({
                  id: p.id, code: p.projectCode, name: p.projectName, location: p.location,
                })
              }
            }
          }
        }
        setProjects(out)
      })
      .catch(() => { /* silent */ })
  }, [])

  // ----- build fetch URL -----
  const buildUrl = useCallback(() => {
    const q = new URLSearchParams()
    if (periodId !== 'all') q.set('periodId', periodId)
    if (projectId !== 'all') q.set('projectId', projectId)
    if (moduleKey !== 'all') q.set('module', moduleKey)
    if (status !== 'all') q.set('status', status)
    return `/api/evidence?${q.toString()}`
  }, [periodId, projectId, moduleKey, status])

  const fetchList = useCallback(() => {
    setLoading(true)
    setError('')
    fetch(buildUrl())
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || `Request failed (${r.status})`)
        }
        return r.json()
      })
      .then((d: { items: EvidenceItem[]; total: number }) => {
        setItems(d.items || [])
        setTotal(d.total || 0)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [buildUrl])

  useEffect(() => { fetchList() }, [fetchList])

  // ----- open detail -----
  const openDetail = useCallback((item: EvidenceItem) => {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    fetch(`/api/evidence/${item.id}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || `Request failed (${r.status})`)
        }
        return r.json()
      })
      .then((d: EvidenceDetail) => {
        setDetail(d)
        setDetailLoading(false)
      })
      .catch((e: Error) => {
        setDetailLoading(false)
        toast.error(`Failed to load evidence: ${e.message}`)
        setDetailOpen(false)
      })
  }, [])

  // ----- verify / reject -----
  const submitVerify = useCallback(async () => {
    if (!verifyTarget) return
    setVerifyBusy(true)
    try {
      const r = await fetch(`/api/evidence/${verifyTarget.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: verifyComment || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Verify failed (${r.status})`)
      toast.success('Evidence verified', { description: verifyTarget.fileName })
      setVerifyTarget(null)
      setVerifyComment('')
      fetchList()
    } catch (e) {
      toast.error('Verify failed', { description: (e as Error).message })
    } finally {
      setVerifyBusy(false)
    }
  }, [verifyTarget, verifyComment, fetchList])

  const submitReject = useCallback(async () => {
    if (!rejectTarget) return
    if (!rejectComment.trim()) {
      toast.error('A rejection comment is required')
      return
    }
    setRejectBusy(true)
    try {
      const r = await fetch(`/api/evidence/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rejectComment }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Reject failed (${r.status})`)
      toast.success('Evidence rejected', { description: rejectTarget.fileName })
      setRejectTarget(null)
      setRejectComment('')
      fetchList()
    } catch (e) {
      toast.error('Reject failed', { description: (e as Error).message })
    } finally {
      setRejectBusy(false)
    }
  }, [rejectTarget, rejectComment, fetchList])

  const roleLabel = user?.roles?.[0]?.name ?? 'User'

  // ---------- Render ----------
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="animate-fade-up stagger-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Evidence Vault</h1>
            <span className="status-pill status-submitted">
              <FileCheck2 className="h-3 w-3" /> {total} document{total === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Verifiable evidence documents backing every source record. · Signed in as <span className="font-semibold text-slate-700">{roleLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchList}
            className="glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {gate.canUpload && (
            <button
              onClick={() => setUploadOpen(true)}
              className="btn-glass-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition hover:opacity-95"
            >
              <Upload className="h-3.5 w-3.5" /> Upload Evidence
            </button>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <div className="glass glass-shimmer animate-fade-up stagger-2 flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-end">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Filter className="h-3.5 w-3.5" /> Filters:
        </div>
        <FilterSelect
          label="Project"
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: 'all', label: 'All projects' },
            ...projects.map(p => ({ value: p.id, label: p.name })),
          ]}
        />
        <FilterSelect
          label="Period"
          value={periodId}
          onChange={setPeriodId}
          options={[
            { value: 'all', label: 'All periods' },
            ...periods.map(p => ({ value: p.id, label: p.label })),
          ]}
        />
        <FilterSelect
          label="Module"
          value={moduleKey}
          onChange={setModuleKey}
          options={[
            { value: 'all', label: 'All modules' },
            ...MODULE_OPTIONS.map(m => ({ value: m.value, label: m.label })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label })),
          ]}
        />
      </div>

      {/* TABLE / states */}
      {loading ? (
        <EvidenceSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchList} />
      ) : items.length === 0 ? (
        <EmptyState canUpload={gate.canUpload} onUpload={() => setUploadOpen(true)} />
      ) : (
        <EvidenceTable
          items={items}
          gate={gate}
          onPreview={openDetail}
          onVerify={(it) => { setVerifyTarget(it); setVerifyComment('') }}
          onReject={(it) => { setRejectTarget(it); setRejectComment('') }}
        />
      )}

      {/* DETAIL SHEET */}
      <Sheet open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) { setDetail(null); setDetailLoading(false) } }}>
        <SheetContent side="right" className="glass-strong w-full overflow-y-auto scroll-elegant p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-white/60 bg-white/40 p-5">
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <FileText className="h-4 w-4 text-blue-600" />
              {detail?.evidence.fileName ?? 'Evidence Detail'}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Metadata · linked source record · full audit trail
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : detail ? (
            <EvidenceDetailPanel detail={detail} gate={gate}
              onVerify={(it) => { setVerifyTarget(it); setVerifyComment('') }}
              onReject={(it) => { setRejectTarget(it); setRejectComment('') }}
              onRefresh={() => openDetail(detail.evidence)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* VERIFY DIALOG */}
      <Dialog open={!!verifyTarget} onOpenChange={(o) => { if (!o) { setVerifyTarget(null); setVerifyComment('') } }}>
        <DialogContent className="glass-strong rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Verify Evidence
            </DialogTitle>
            <DialogDescription className="text-xs">
              You are verifying <span className="font-semibold text-slate-700">{verifyTarget?.fileName}</span>.
              The uploader will be notified and the document becomes locked for further edits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="verifyComment" className="text-xs font-semibold text-slate-600">
              Verification comment <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="verifyComment"
              value={verifyComment}
              onChange={(e) => setVerifyComment(e.target.value)}
              placeholder="e.g. Bill matches meter reading — approved."
              rows={3}
              className="bg-white/60"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => { setVerifyTarget(null); setVerifyComment('') }} className="text-slate-600">
              Cancel
            </Button>
            <Button
              onClick={submitVerify}
              disabled={verifyBusy}
              className="btn-glass-primary rounded-full"
            >
              {verifyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Confirm Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectComment('') } }}>
        <DialogContent className="glass-strong rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <XCircle className="h-4 w-4 text-rose-600" /> Reject Evidence
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rejecting <span className="font-semibold text-slate-700">{rejectTarget?.fileName}</span>. A reason is required so the uploader can fix and re-upload.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rejectComment" className="text-xs font-semibold text-slate-600">
              Reason for rejection <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="rejectComment"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="e.g. Invoice date does not match reporting period."
              rows={3}
              className="bg-white/60"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectComment('') }} className="text-slate-600">
              Cancel
            </Button>
            <Button
              onClick={submitReject}
              disabled={rejectBusy}
              className="rounded-full bg-rose-500 text-white hover:bg-rose-600"
            >
              {rejectBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPLOAD SHEET (demo — metadata-only) */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent side="right" className="glass-strong w-full overflow-y-auto scroll-elegant p-0 sm:max-w-md">
          <SheetHeader className="border-b border-white/60 bg-white/40 p-5">
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Upload className="h-4 w-4 text-blue-600" /> Upload Evidence
            </SheetTitle>
            <SheetDescription className="text-xs">
              Attach a document to a project · reporting period · module.
            </SheetDescription>
          </SheetHeader>
          <UploadForm
            projects={projects}
            periods={periods}
            onClose={() => setUploadOpen(false)}
            onUploaded={() => { setUploadOpen(false); fetchList() }}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ============================================================
// Building blocks
// ============================================================

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="glass-subtle w-full min-w-[160px] border-transparent bg-transparent text-xs font-semibold text-slate-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function EvidenceTable({
  items, gate, onPreview, onVerify, onReject,
}: {
  items: EvidenceItem[]
  gate: RoleGate
  onPreview: (it: EvidenceItem) => void
  onVerify: (it: EvidenceItem) => void
  onReject: (it: EvidenceItem) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-2"
    >
      <Table>
        <TableHeader>
          <TableRow className="border-white/40 hover:bg-transparent">
            <TableHead className="pl-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Document</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Type</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Linked Record</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Period / Project</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Uploaded By</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Verification</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Version</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hash</TableHead>
            <TableHead className="pr-4 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, i) => (
            <motion.tr
              key={it.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.32), duration: 0.32 }}
              className="group cursor-pointer border-b border-white/40 transition hover:bg-white/60"
              onClick={() => onPreview(it)}
            >
              <TableCell className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-sky-100 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{it.fileName}</div>
                    <div className="text-[10px] text-slate-400">{fmtSize(it.fileSize)} · {it.mimeType}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3 text-xs text-slate-600">
                {DOC_TYPE_LABEL[it.documentType] ?? it.documentType}
              </TableCell>
              <TableCell className="py-3 text-xs text-slate-600">
                {it.sourceRecordId ? (
                  <span className="status-pill status-submitted">
                    <Link2 className="h-3 w-3" /> Linked
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="py-3 text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <span>{fmtDate(it.documentDate)}</span>
                </div>
                <div className="text-[10px] text-slate-400">{it.module ?? '—'}</div>
              </TableCell>
              <TableCell className="py-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <User className="h-3 w-3" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-700">{it.uploader.name}</div>
                    <div className="text-[10px] text-slate-400">{it.uploader.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3">
                <span className={`status-pill ${statusPillClass(it.status)}`}>
                  {it.status === 'VERIFIED' && <CheckCircle2 className="h-3 w-3" />}
                  {it.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                  {it.status === 'UPLOADED' && <FileText className="h-3 w-3" />}
                  {statusLabel(it.status)}
                </span>
              </TableCell>
              <TableCell className="py-3 text-xs text-slate-600">
                {it.verifiedBy ? (
                  <div>
                    <div className="font-semibold text-emerald-700">Verified</div>
                    <div className="text-[10px] text-slate-400">{fmtDate(it.verifiedAt)}</div>
                  </div>
                ) : (
                  <span className="text-slate-400">Pending</span>
                )}
              </TableCell>
              <TableCell className="py-3 text-xs tabular-nums text-slate-700">v{it.version}</TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  <Hash className="h-2.5 w-2.5" />
                  {truncateHash(it.hash)}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <RowAction icon={Eye} label="Preview" tone="slate" onClick={() => onPreview(it)} />
                  {gate.canVerify && it.status !== 'VERIFIED' && it.status !== 'REJECTED' && (
                    <>
                      <RowAction icon={ShieldCheck} label="Verify" tone="emerald" onClick={() => onVerify(it)} />
                      <RowAction icon={XCircle} label="Reject" tone="rose" onClick={() => onReject(it)} />
                    </>
                  )}
                  <RowAction icon={History} label="History" tone="slate" onClick={() => onPreview(it)} />
                </div>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  )
}

function RowAction({
  icon: Icon, label, tone, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone: 'slate' | 'emerald' | 'rose'
  onClick: () => void
}) {
  const toneClass = {
    slate: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    emerald: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
    rose: 'text-rose-600 hover:bg-rose-50 hover:text-rose-700',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function EvidenceDetailPanel({
  detail, gate, onVerify, onReject, onRefresh,
}: {
  detail: EvidenceDetail
  gate: RoleGate
  onVerify: (it: EvidenceItem) => void
  onReject: (it: EvidenceItem) => void
  onRefresh: () => void
}) {
  const e = detail.evidence
  const linkedSource = detail.linkedSourceRecord as Record<string, unknown> | null
  return (
    <div className="space-y-5 p-5">
      {/* FILE PREVIEW */}
      <FilePreviewPanel evidence={e} />

      {/* STATUS ROW */}
      <div className="flex items-center justify-between rounded-xl bg-white/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`status-pill ${statusPillClass(e.status)}`}>
            {e.status === 'VERIFIED' && <CheckCircle2 className="h-3 w-3" />}
            {e.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
            {statusLabel(e.status)}
          </span>
          <span className="text-[11px] text-slate-400">v{e.version} · updated {fmtDate(e.updatedAt)}</span>
        </div>
        {gate.canVerify && e.status !== 'VERIFIED' && e.status !== 'REJECTED' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onVerify(e)}
              className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <ShieldCheck className="h-3 w-3" /> Verify
            </button>
            <button
              onClick={() => onReject(e)}
              className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <XCircle className="h-3 w-3" /> Reject
            </button>
          </div>
        )}
      </div>

      {/* METADATA */}
      <div className="glass-subtle rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Document Metadata</h3>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <Meta label="Document Type" value={DOC_TYPE_LABEL[e.documentType] ?? e.documentType} icon={FileType2} />
          <Meta label="Document Date" value={fmtDate(e.documentDate)} icon={Calendar} />
          <Meta label="Module" value={e.module ?? '—'} icon={FolderOpen} />
          <Meta label="MIME Type" value={e.mimeType} icon={FileText} />
          <Meta label="Version" value={`v${e.version}`} icon={History} />
          <Meta label="File Size" value={fmtSize(e.fileSize)} icon={FileCheck2} />
          <Meta label="Project" value={detail.project?.projectName ?? '—'} icon={Building2} />
          <Meta label="Reporting Period" value={detail.reportingPeriod?.periodLabel ?? '—'} icon={Calendar} />
        </dl>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Content Hash (SHA-256)</div>
          <div className="mt-0.5 break-all font-mono text-[10px] text-slate-600">{e.hash ?? '—'}</div>
        </div>
        {e.verificationComment && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase text-emerald-700">Verification Comment</div>
            <div className="mt-0.5 text-xs text-emerald-800">{e.verificationComment}</div>
          </div>
        )}
      </div>

      {/* LINKED SOURCE RECORD */}
      <div className="glass-subtle rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Linked Source Record</h3>
        </div>
        {linkedSource ? (
          <div className="space-y-1.5 text-xs">
            {Object.entries(linkedSource).filter(([k]) => !k.startsWith('_')).slice(0, 6).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-md bg-white/40 px-2.5 py-1.5">
                <span className="text-slate-500">{k}</span>
                <span className="font-mono text-[10px] text-slate-700">
                  {typeof v === 'object' ? '—' : String(v)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400">No source record linked.</div>
        )}
      </div>

      {/* AUDIT TRAIL */}
      <div className="glass-subtle rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Audit Trail</h3>
        </div>
        {detail.auditTrail.length === 0 ? (
          <div className="text-xs text-slate-400">No audit events recorded.</div>
        ) : (
          <ol className="relative space-y-3 border-l border-white/60 pl-4">
            {detail.auditTrail.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                className="relative"
              >
                <span className="absolute -left-[18px] flex h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                <div className="text-xs font-semibold text-slate-700">{a.action.replace(/_/g, ' ')}</div>
                <div className="text-[11px] text-slate-500">
                  {a.actorName} · {a.actorRole}
                </div>
                <div className="text-[10px] text-slate-400">{fmtDateTime(a.createdAt)}</div>
                {a.reason && <div className="mt-0.5 text-[11px] italic text-slate-500">“{a.reason}”</div>}
              </motion.li>
            ))}
          </ol>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-white/60 pt-3">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
        >
          <RefreshCw className="h-3 w-3" /> Refresh detail
        </button>
        <button
          onClick={() => {
            // Replace is metadata-only in demo
            toast.info('Replace is metadata-only in this demo', { description: 'Use the Upload flow to attach a new version.' })
          }}
          className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <ArrowRight className="h-3 w-3" /> Replace version
        </button>
      </div>
    </div>
  )
}

function Meta({
  label, value, icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-0.5 truncate text-xs font-semibold text-slate-700">{value}</dd>
    </div>
  )
}

// FilePreviewPanel — renders the actual file inline (PDF / image) or shows a download link
function FilePreviewPanel({ evidence: e }: { evidence: EvidenceItem }) {
  const previewUrl = `/api/evidence/${e.id}/file`
  const downloadUrl = `/api/evidence/${e.id}/file?download=true`

  const isPdf = e.mimeType === 'application/pdf' || e.fileName.toLowerCase().endsWith('.pdf')
  const isImage = e.mimeType.startsWith('image/')

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-subtle relative overflow-hidden rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/40 px-4 py-2">
        <div className="flex items-center gap-2">
          <FileType2 className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700 truncate max-w-[260px]">{e.fileName}</span>
          <span className="text-[10px] text-slate-400">{e.mimeType} · {fmtSize(e.fileSize)}</span>
        </div>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          <Upload className="h-3 w-3 rotate-180" /> Download
        </a>
      </div>

      {isPdf ? (
        <iframe
          src={previewUrl}
          title={e.fileName}
          className="h-96 w-full border-0 bg-white"
          sandbox="allow-same-origin allow-scripts"
        />
      ) : isImage ? (
        <img
          src={previewUrl}
          alt={e.fileName}
          className="max-h-96 w-full object-contain bg-white p-2"
        />
      ) : (
        <div className="flex h-32 items-center justify-center text-slate-400">
          <div className="flex flex-col items-center gap-2">
            <FileType2 className="h-8 w-8" />
            <span className="text-xs">No inline preview for this file type.</span>
            <a
              href={downloadUrl}
              className="text-xs font-semibold text-blue-600 underline"
            >
              Download to view
            </a>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function UploadForm({
  projects, periods, onClose, onUploaded,
}: {
  projects: ProjectOption[]
  periods: PeriodOption[]
  onClose: () => void
  onUploaded?: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('INVOICE')
  const [docDate, setDocDate] = useState('')
  const [mod, setMod] = useState('ENERGY')
  const [projId, setProjId] = useState(projects[0]?.id ?? '')
  const [perId, setPerId] = useState(periods[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!projId && projects.length > 0) {
      setProjId(projects[0].id)
    }
  }, [projects, projId])

  useEffect(() => {
    if (!perId && periods.length > 0) {
      setPerId(periods[0].id)
    }
  }, [periods, perId])

  const handleDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault()
    setDragOver(false)
    const f = ev.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  const submit = async () => {
    if (!file) {
      toast.error('Please select a file to upload')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('documentType', docType)
      if (docDate) fd.append('documentDate', docDate)
      fd.append('module', mod)
      if (projId && projId !== 'none') fd.append('projectId', projId)
      if (perId && perId !== 'none') fd.append('periodId', perId)

      const res = await fetch('/api/evidence', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `Upload failed (${res.status})`)

      toast.success('Evidence uploaded', {
        description: `${file.name} uploaded and saved successfully.`,
      })
      onClose()
      onUploaded?.()
    } catch (e: any) {
      toast.error('Upload failed', { description: String(e?.message ?? e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-5">
      {/* DROP ZONE */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : file
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <Upload className={`h-8 w-8 ${ file ? 'text-emerald-600' : 'text-slate-300' }`} />
        {file ? (
          <>
            <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
            <p className="text-[11px] text-slate-400">{fmtSize(file.size)} · {file.type || 'unknown type'}</p>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-[11px] text-rose-500 underline"
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-600">Drag &amp; drop a file here</p>
            <p className="text-[11px] text-slate-400">or click to browse</p>
          </>
        )}
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.docx,.zip"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setFile(f)
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-600">Document Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="bg-white/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-600">Document Date</Label>
          <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="bg-white/60" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-600">Module</Label>
          <Select value={mod} onValueChange={setMod}>
            <SelectTrigger className="bg-white/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODULE_OPTIONS.map(m => (
                <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-600">Project</Label>
          <Select value={projId || undefined} onValueChange={setProjId}>
            <SelectTrigger className="bg-white/60"><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.length > 0 ? projects.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              )) : (
                <SelectItem value="none" disabled className="text-xs text-slate-400">No projects loaded</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-600">Reporting Period</Label>
        <Select value={perId || undefined} onValueChange={setPerId}>
          <SelectTrigger className="bg-white/60"><SelectValue placeholder="Select period" /></SelectTrigger>
          <SelectContent>
            {periods.length > 0 ? periods.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>
            )) : (
              <SelectItem value="none" disabled className="text-xs text-slate-400">No periods loaded</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/60 pt-3">
        <Button variant="ghost" onClick={onClose} className="text-slate-600">Cancel</Button>
        <Button onClick={submit} disabled={busy || !file} className="btn-glass-primary rounded-full">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </div>
  )
}

function EvidenceSkeleton() {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200/60" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load evidence</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">
        Retry
      </button>
    </div>
  )
}

function EmptyState({ canUpload, onUpload }: { canUpload: boolean; onUpload: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <Inbox className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No evidence documents yet</div>
        <div className="text-xs text-slate-500">Upload your first evidence document to back a source record.</div>
      </div>
      {canUpload && (
        <button onClick={onUpload} className="btn-glass-primary flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold">
          <Upload className="h-3.5 w-3.5" /> Upload Evidence
        </button>
      )}
    </div>
  )
}
