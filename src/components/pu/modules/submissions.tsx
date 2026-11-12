'use client'
/**
 * Submissions Module — Task 7-UI
 *
 * The workflow review screen for the MEIL ESG / BRSR Reporting Platform.
 * Lists submissions from GET /api/submissions, drives the workflow
 * state machine (DRAFT → SUBMITTED → UNDER_REVIEW → … → LOCKED) via
 * submit / review / approve / reject / resubmit / lock endpoints, and
 * opens a rich detail sheet with the full chain (source records, evidence,
 * validation, calculations, comments, history, corrections).
 *
 * Role-gated actions: site data-entry roles (PROJECT_USER, HR, EHS,
 * Procurement, CSR, Compliance, Finance) can submit/resubmit; reviewer
 * roles are currently removed — see useRoleGate for the re-add point.
 * Premium light glass aesthetic.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MeilLoader, MeilBoxLoader } from '@/components/shared/meil-loader'
import {
  SubmissionReviewWindow,
  buildReviewModelFromPuDetail,
  type ReviewModel,
} from '@/components/shared/submission-review-window'
import { MultiEvidenceGallery, type MultiEvidenceDoc } from '@/components/shared/multi-evidence-gallery'
import { toast } from 'sonner'
import {
  ClipboardList, RefreshCw, Filter, AlertOctagon, Inbox,
  Send, ShieldCheck, XCircle, Lock, History, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, FileCheck2, Files, ListChecks, Calculator, MessageSquare,
  Building2, CalendarDays, FolderOpen, Layers, Plus, Trash2, Eye, RotateCcw,
  FileText, FileSpreadsheet, BookOpen, Printer, Search,
} from 'lucide-react'
import { Ring } from '@/components/ring'
import { useApp } from '@/lib/pu/auth-context'
import { fieldLabel, fmtValue, itemFieldEntries, itemTitle } from '@/components/shared/field-labels'
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
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format as dfnFormat } from 'date-fns'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, FileDown, CheckSquare, X, Download, ExternalLink } from 'lucide-react'

// ---------- Types (mirror API response shapes) ----------

interface ProjectInfo {
  id: string; projectCode: string; projectName: string;
  location: string | null; status: string;
  businessUnit?: { id: string; name: string; subsidiary?: { id: string; name: string } | null } | null
}
interface PeriodInfo {
  id: string; periodLabel: string; year: number; month: number | null;
  status: string; reportingYear?: { id: string; label: string; year: number } | null
}
interface ReviewerInfo { id: string; name: string; email: string }
interface HistoryEntry {
  id: string; fromStatus: string; toStatus: string; action: string;
  actorId: string; actorName: string; actorRole: string;
  comment: string | null; createdAt: string
}
interface SubmissionListItem {
  id: string; projectId: string; reportingPeriodId: string; module: string; title: string;
  status: string; completionPct: number; evidenceCount: number;
  validationPassed: number; validationErrors: number;
  submittedBy: string; submittedAt: string | null;
  currentReviewerId: string | null; reviewComment: string | null;
  reviewedAt?: string | null;
  lockedAt: string | null; lockedBy: string | null;
  createdAt: string; updatedAt: string;
  parsedValues?: Array<{ label: string; value: string | number; unit?: string }>;
  evidenceList?: string[];
  formattedDateTime?: string;
  project: ProjectInfo;
  reportingPeriod: PeriodInfo;
  currentReviewer: ReviewerInfo | null;
  history: HistoryEntry[];
  _count?: { corrections: number }
}

interface Correction {
  id: string; recordId?: string | null; field: string; issue: string; severity: string;
  status: string; comment: string | null; requesterName: string;
  createdAt: string; resolvedAt: string | null; resolutionComment: string | null
}

interface EvidenceBrief {
  id: string; fileName: string; documentType: string; status: string;
  uploader?: { name: string }; createdAt: string
}

interface ValidationResultRow {
  id: string; ruleCode: string; severity: string; message: string;
  field: string | null; status: string; detectedAt: string
}

interface CalcResultRow {
  id: string; calculatedValue: number; resultUnit: string | null;
  scope: string | null; factorVersion: number | null; calculatedAt: string
}

interface SourceRecordRow {
  id: string; [k: string]: unknown
}

interface SubmissionDetail {
  submission: SubmissionListItem & { recordIds: string[] };
  sourceRecords: SourceRecordRow[];
  evidence: EvidenceBrief[];
  validationResults: ValidationResultRow[];
  calculationResults: CalcResultRow[];
  brsrMappings: Array<{ id: string; question?: { questionCode: string; questionText: string } } | Record<string, unknown>>;
  auditTrail: Array<{
    id: string; action: string; actorName: string; actorRole: string;
    reason: string | null; createdAt: string
  }>;
}

interface PeriodOption { id: string; label: string; year: number; month: number | null }
interface ProjectOption { id: string; code: string; name: string; location: string | null }
interface Kpis {
  draftSubs: number; reviewSubs: number; approvedSubs: number;
  corrections: number; openExceptions: number; totalSubs: number; completion: number
}

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
  { value: 'ENERGY', label: 'L1 · Energy' },
  { value: 'WATER', label: 'L2 · Water' },
  { value: 'EMISSIONS', label: 'L3 · GHG & Air' },
  { value: 'WASTE', label: 'L4 · Waste' },
  { value: 'SAFETY', label: 'L5 · Safety' },
  { value: 'PEOPLE', label: 'L6 · Workforce' },
  { value: 'TRAINING', label: 'L6 · Training' },
  { value: 'COMPLIANCE', label: 'L7 · Compliance' },
  { value: 'INCIDENTS', label: 'L8 · Incidents & Grievances' },
  { value: 'INITIATIVES', label: 'L9 · Initiatives' },
  { value: 'TRAVEL', label: 'Travel' },
] as const

const STATUS_CHIPS = [
  { key: 'all', label: 'All Submissions', filter: '' },
  { key: 'SUBMITTED', label: 'Pending Review', filter: 'SUBMITTED' },
  { key: 'CORRECTION_REQUIRED', label: 'Corrections / Rejected', filter: 'CHANGES_REQUESTED' },
  { key: 'APPROVED', label: 'Approved & Active', filter: 'APPROVED' },
  { key: 'DRAFT', label: 'Drafts', filter: 'DRAFT' },
  { key: 'LOCKED', label: 'Locked & Sealed', filter: 'LOCKED' },
] as const

// Workflow state machine (matches src/lib/workflow.ts)
const PIPELINE = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'BU_APPROVED',
  'SUBSIDIARY_APPROVED', 'HQ_REVIEW', 'LOCKED',
] as const

const PIPELINE_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Pending',
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  BU_APPROVED: 'Approved (Project Admin)',
  SUBSIDIARY_APPROVED: 'Active (Subsidiary)',
  HQ_REVIEW: 'HQ Review',
  APPROVED: 'Active',
  ACTIVE: 'Active',
  LOCKED: 'Locked',
  CORRECTION_REQUESTED: 'Correction Required',
  RESUBMITTED: 'Pending (Resubmitted)',
}

const ACTION_LABEL: Record<string, string> = {
  SUBMIT: 'Submit', REVIEW: 'Start Review', APPROVE: 'Approve',
  REJECT: 'Request Correction', RESUBMIT: 'Resubmit', LOCK: 'Lock',
}

// ---------- Report export formats ----------

type ReportFormat = 'pdf' | 'excel' | 'word' | 'html'

const REPORT_FORMATS: Array<{
  format: ReportFormat
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  iconBox: string
}> = [
  {
    format: 'pdf',
    label: 'PDF Document',
    desc: 'Branded report with full project, source & evidence tables',
    icon: FileText,
    iconBox: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    format: 'excel',
    label: 'Excel (CSV)',
    desc: 'Opens in Excel — every section as data rows',
    icon: FileSpreadsheet,
    iconBox: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  {
    format: 'word',
    label: 'Word Document',
    desc: 'Editable .doc narrative for review notes & letters',
    icon: BookOpen,
    iconBox: 'bg-amber-50 text-amber-600 border-amber-200',
  },
  {
    format: 'html',
    label: 'Print View',
    desc: 'Opens in browser — Print / Save as PDF with linked evidence',
    icon: Printer,
    iconBox: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
]

// ---------- Calendar helpers (find submissions by submitted date) ----------

const dayKey = (d: Date) => dfnFormat(d, 'yyyy-MM-dd')

function effectiveDateOf(s: SubmissionListItem): Date {
  return new Date(s.submittedAt || s.updatedAt || s.createdAt)
}

// ---------- Role helpers ----------

interface RoleGate {
  canSubmit: boolean      // site data-entry roles
  canReview: boolean      // reviewer roles (none seeded yet)
  canReject: boolean      // reviewer roles (none seeded yet)
  canApprove: boolean     // reviewer roles (none seeded yet)
  canLock: boolean        // group reviewer roles (none seeded yet)
  isReadOnly: boolean     // analyst roles
}

function useRoleGate(): RoleGate {
  const { user } = useApp()
  const key = user?.roles?.[0]?.key ?? ''
  const isReviewer =
    key === 'PROJECT_ADMIN' ||
    key === 'GROUP_ADMIN' ||
    key === 'SUBSIDIARY_ADMIN' ||
    key === 'BU_ADMIN' ||
    Boolean(user?.email?.includes('projectadmin')) ||
    Boolean(user?.email?.includes('admin@site'))

  return {
    canSubmit: key === 'PROJECT_USER' || key === 'HR_USER' || key === 'EHS_USER' || key === 'PROCUREMENT_USER' || key === 'CSR_USER' || key === 'COMPLIANCE_USER' || key === 'FINANCE_USER' || isReviewer,
    canReview: isReviewer,
    canReject: isReviewer,
    canApprove: isReviewer,
    canLock: isReviewer,
    isReadOnly: key === 'ESG_ANALYST',
  }
}

// ---------- Status pill mapping (mirrors evidence module) ----------

function statusPillClass(status: string): string {
  switch (status) {
    case 'DRAFT': return 'status-draft bg-slate-100 text-slate-700 border border-slate-200'
    case 'SUBMITTED':
    case 'PENDING':
    case 'RESUBMITTED': return 'status-submitted bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs font-semibold'
    case 'UNDER_REVIEW':
    case 'HQ_REVIEW': return 'status-review bg-indigo-50 text-indigo-800 border border-indigo-300 font-semibold'
    case 'BU_APPROVED':
    case 'SUBSIDIARY_APPROVED':
    case 'APPROVED':
    case 'ACTIVE': return 'status-approved bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs font-bold'
    case 'LOCKED': return 'status-locked bg-purple-50 text-purple-800 border border-purple-300 font-semibold'
    case 'CHANGES_REQUESTED':
    case 'REJECTED':
    case 'CORRECTION_REQUESTED': return 'status-warning bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs font-bold'
    default: return 'status-draft bg-slate-100 text-slate-700 border border-slate-200'
  }
}

/** Row accent — colored left rail + subtle tint so each workflow state is
 *  recognizable at a glance while scanning the table. */
function statusRowAccent(status: string): string {
  switch (status) {
    case 'DRAFT': return 'border-l-4 border-l-slate-300'
    case 'SUBMITTED':
    case 'PENDING':
    case 'RESUBMITTED': return 'border-l-4 border-l-sky-400 bg-sky-50/30'
    case 'UNDER_REVIEW':
    case 'HQ_REVIEW': return 'border-l-4 border-l-indigo-400 bg-indigo-50/30'
    case 'BU_APPROVED':
    case 'SUBSIDIARY_APPROVED':
    case 'APPROVED':
    case 'ACTIVE': return 'border-l-4 border-l-emerald-400 bg-emerald-50/25'
    case 'LOCKED': return 'border-l-4 border-l-purple-400 bg-purple-50/25'
    case 'CHANGES_REQUESTED':
    case 'REJECTED':
    case 'CORRECTION_REQUESTED': return 'border-l-4 border-l-rose-400 bg-rose-50/30'
    default: return 'border-l-4 border-l-slate-200'
  }
}

/** Module badge colors — one distinct hue per BRSR disclosure level. */
const MODULE_BADGE: Record<string, string> = {
  ENERGY: 'bg-amber-50 text-amber-800 border-amber-200',
  WATER: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  EMISSIONS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  WASTE: 'bg-orange-50 text-orange-800 border-orange-200',
  SAFETY: 'bg-rose-50 text-rose-800 border-rose-200',
  PEOPLE: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
  TRAINING: 'bg-pink-50 text-pink-800 border-pink-200',
  COMPLIANCE: 'bg-violet-50 text-violet-800 border-violet-200',
  INCIDENTS: 'bg-red-50 text-red-800 border-red-200',
  INITIATIVES: 'bg-teal-50 text-teal-800 border-teal-200',
  TRAVEL: 'bg-blue-50 text-blue-800 border-blue-200',
}
function moduleBadgeClass(mod: string): string {
  return MODULE_BADGE[String(mod || '').toUpperCase()] ?? 'bg-slate-50 text-slate-700 border-slate-200'
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

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ============================================================
// Main component
// ============================================================

export function SubmissionsModule() {
  const { user, loading: sessionLoading, setActiveModule } = useApp()
  const gate = useRoleGate()

  const [items, setItems] = useState<SubmissionListItem[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])

  const [periodId, setPeriodId] = useState<string>('all')
  /* Project filter is always a concrete project — no "All projects" option.
     Starts empty and resolves to the first project right after the tree loads. */
  const [projectId, setProjectId] = useState<string>('')
  const [projectsReady, setProjectsReady] = useState(false)
  const [moduleKey, setModuleKey] = useState<string>('all')
  const [chipFilter, setChipFilter] = useState<string>('all')

  // Bulk actions + sort + pagination state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<'title' | 'period' | 'completion' | 'submittedAt' | 'status'>('submittedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportStep, setReportStep] = useState<'picker' | 'format'>('picker')
  const [reportSearch, setReportSearch] = useState('')
  const [reportTarget, setReportTarget] = useState<SubmissionListItem | null>(null)
  const [reportDownloading, setReportDownloading] = useState<string | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SubmissionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  /* Calendar filter — find submissions by the date they were submitted. */
  const [calDate, setCalDate] = useState<Date | undefined>(undefined)
  const [calOpen, setCalOpen] = useState(false)

  const [approveTarget, setApproveTarget] = useState<SubmissionListItem | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [approveBusy, setApproveBusy] = useState(false)

  const [rejectTarget, setRejectTarget] = useState<SubmissionListItem | null>(null)
  const [rejectFields, setRejectFields] = useState<Array<{ field: string; issue: string; severity: string; comment: string }>>([
    { field: '', issue: '', severity: 'WARNING', comment: '' },
  ])
  const [rejectGeneral, setRejectGeneral] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)

  // ----- fetch periods + projects (filters) + KPIs -----
  useEffect(() => {
    fetch('/api/pu/overview')
      .then(r => r.json())
      .then((d: { periods?: PeriodOption[]; kpis?: Kpis }) => {
        const ps: PeriodOption[] = (d.periods || []).map((p) => ({
          id: p.id, label: p.label, year: p.year, month: p.month,
        }))
        setPeriods(ps)
        if (d.kpis) setKpis(d.kpis)
      })
      .catch(() => { /* silent */ })

    fetch('/api/pu/organization/tree')
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
        /* No "All projects" — resolve to the signed-in user's OWN project when
           it is in the tree, falling back to the first concrete project. (The
           tree returns every project in the org; defaulting to out[0] silently
           hid the user's own submissions behind another project's filter.) */
        if (out.length > 0) {
          const ownProjectId = user?.scopes?.find((s) => s.scopeType === 'PROJECT')?.scopeId
          setProjectId((prev) => (prev ? prev : (ownProjectId && out.some((p) => p.id === ownProjectId) ? ownProjectId : out[0].id)))
        }
      })
      .catch(() => { /* silent — list stays user-scoped */ })
      .finally(() => setProjectsReady(true))
    }, [])

  // ----- list URL builder -----
  const buildUrl = useCallback(() => {
    const q = new URLSearchParams()
    if (periodId !== 'all') q.set('periodId', periodId)
    if (projectId) q.set('projectId', projectId)
    if (moduleKey !== 'all') q.set('module', moduleKey)
    q.set('take', '100')
    q.set('bypass', 'true')
    return `/api/pu/submissions?${q.toString()}`
  }, [periodId, projectId, moduleKey])

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
      .then((d: { items: SubmissionListItem[] }) => {
        setItems(d.items || [])
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [buildUrl])

  /* Wait for the session AND for the project filter to resolve (no
     "All projects" — the concrete project is auto-picked) before the first
     fetch, so the list loads exactly once instead of refetching after
     the tree arrives. */
  useEffect(() => {
    const projectResolved = projectId !== '' || (projectsReady && projects.length === 0)
    if (sessionLoading || !projectResolved) return
    fetchList()
  }, [fetchList, sessionLoading, projectId, projectsReady, projects.length])

  // ----- counts per chip -----
  const chipCounts = useMemo(() => {
    const m: Record<string, number> = { all: items.length, DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, CORRECTION_REQUIRED: 0, APPROVED: 0, LOCKED: 0 }
    for (const it of items) {
      if (it.status === 'DRAFT') m.DRAFT++
      else if (it.status === 'SUBMITTED' || it.status === 'RESUBMITTED' || it.status === 'PENDING') m.SUBMITTED++
      else if (it.status === 'UNDER_REVIEW') m.UNDER_REVIEW++
      else if (it.status === 'CORRECTION_REQUESTED' || it.status === 'CHANGES_REQUESTED' || it.status === 'REJECTED') m.CORRECTION_REQUIRED++
      else if (it.status === 'APPROVED' || it.status === 'ACTIVE' || it.status === 'BU_APPROVED' || it.status === 'SUBSIDIARY_APPROVED' || it.status === 'HQ_REVIEW') m.APPROVED++
      else if (it.status === 'LOCKED') m.LOCKED++
    }
    return m
  }, [items])

  // ----- calendar day counts (find submissions by submitted date) -----
  const countsByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) {
      const k = dayKey(effectiveDateOf(it))
      m.set(k, (m.get(k) || 0) + 1)
    }
    return m
  }, [items])

  /** Month to open the calendar on — most recent submission month. */
  const calDefaultMonth = useMemo(() => {
    if (calDate) return calDate
    let best: Date | null = null
    for (const it of items) {
      const d = effectiveDateOf(it)
      if (!best || d > best) best = d
    }
    return best ?? new Date()
  }, [items, calDate])

  const dayTotalFor = (d: Date): number => countsByDay.get(dayKey(d)) ?? 0

  // ----- 1) calendar filter → 2) status chip filter -----
  const calendarFiltered = useMemo(() => {
    if (!calDate) return items
    const k = dayKey(calDate)
    return items.filter(it => dayKey(effectiveDateOf(it)) === k)
  }, [items, calDate])

  const filteredItems = useMemo(() => {
    if (chipFilter === 'all') return calendarFiltered
    const sf = STATUS_CHIPS.find(c => c.key === chipFilter)
    if (!sf || !sf.filter) return calendarFiltered
    if (sf.filter === 'SUBMITTED') {
      return calendarFiltered.filter(it => it.status === 'SUBMITTED' || it.status === 'RESUBMITTED' || it.status === 'PENDING')
    }
    if (sf.filter === 'APPROVED') {
      return calendarFiltered.filter(it =>
        it.status === 'APPROVED' || it.status === 'ACTIVE' || it.status === 'BU_APPROVED' || it.status === 'SUBSIDIARY_APPROVED' || it.status === 'HQ_REVIEW'
      )
    }
    if (sf.filter === 'CHANGES_REQUESTED') {
      return calendarFiltered.filter(it =>
        it.status === 'CORRECTION_REQUESTED' || it.status === 'CHANGES_REQUESTED' || it.status === 'REJECTED'
      )
    }
    return calendarFiltered.filter(it => it.status === sf.filter)
  }, [calendarFiltered, chipFilter])

  // ----- sorted + paginated items -----
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'title') cmp = (a.title || '').localeCompare(b.title || '')
      else if (sortKey === 'period') cmp = (a.reportingPeriod?.periodLabel || '').localeCompare(b.reportingPeriod?.periodLabel || '')
      else if (sortKey === 'completion') cmp = (a.completionPct || 0) - (b.completionPct || 0)
      else if (sortKey === 'submittedAt') {
        const da = a.submittedAt ? new Date(a.submittedAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime()
        const db = b.submittedAt ? new Date(b.submittedAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime()
        cmp = da - db
      } else if (sortKey === 'status') cmp = (a.status || '').localeCompare(b.status || '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filteredItems, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === pagedItems.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(pagedItems.map(s => s.id)))
  }
  const clearSelection = () => setSelectedIds(new Set())

  // ----- open detail -----
  const openDetail = useCallback((id: string) => {
    setDetailId(id)
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    fetch(`/api/pu/submissions/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || `Request failed (${r.status})`)
        }
        return r.json()
      })
      .then((d: SubmissionDetail) => {
        setDetail(d)
        setDetailLoading(false)
      })
      .catch((e: Error) => {
        setDetailLoading(false)
        toast.error(`Failed to load submission: ${e.message}`)
        setDetailOpen(false)
      })
  }, [])

  const refreshDetail = useCallback(() => {
    if (detailId) openDetail(detailId)
  }, [detailId, openDetail])

  // ----- workflow actions -----
  const callWorkflow = useCallback(async (
    target: SubmissionListItem,
    action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock',
    body?: Record<string, unknown>,
  ) => {
    try {
      const r = await fetch(`/api/pu/submissions/${target.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `${action} failed (${r.status})`)
      toast.success(`${ACTION_LABEL[action] || action} succeeded`, { description: target.title })
      fetchList()
      // Refresh detail if open and same submission
      if (detailId === target.id) refreshDetail()
      return j
    } catch (e) {
      toast.error(`${action} failed`, { description: (e as Error).message })
      throw e
    }
  }, [detailId, fetchList, refreshDetail])

  const handleQuickAction = useCallback(async (
    item: SubmissionListItem,
    action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock',
  ) => {
    await callWorkflow(item, action, {})
  }, [callWorkflow])

  const submitApprove = useCallback(async () => {
    if (!approveTarget) return
    setApproveBusy(true)
    try {
      await callWorkflow(approveTarget, 'approve', { comment: approveComment || undefined })
      setApproveTarget(null)
      setApproveComment('')
    } catch {
      /* toast already shown */
    } finally {
      setApproveBusy(false)
    }
  }, [approveTarget, approveComment, callWorkflow])

  const submitReject = useCallback(async () => {
    if (!rejectTarget) return
    const valid = rejectFields.filter(f => f.field.trim() && f.issue.trim())
    if (valid.length === 0) {
      toast.error('At least one correction field with an issue is required')
      return
    }
    setRejectBusy(true)
    try {
      await callWorkflow(rejectTarget, 'reject', {
        fields: valid,
        comment: rejectGeneral || undefined,
      })
      setRejectTarget(null)
      setRejectFields([{ field: '', issue: '', severity: 'WARNING', comment: '' }])
      setRejectGeneral('')
    } catch {
      /* toast already shown */
    } finally {
      setRejectBusy(false)
    }
  }, [rejectTarget, rejectFields, rejectGeneral, callWorkflow])

  // ----- permitted action for a submission given role + status -----
  function permittedActions(s: SubmissionListItem): Array<{
    action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock'
    label: string
    tone: 'blue' | 'emerald' | 'rose' | 'amber' | 'slate'
  }> {
    const out: Array<{ action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock'; label: string; tone: 'blue' | 'emerald' | 'rose' | 'amber' | 'slate' }> = []
    if (gate.isReadOnly) return out
    switch (s.status) {
      case 'DRAFT':
        if (gate.canSubmit) out.push({ action: 'submit', label: 'Submit', tone: 'blue' })
        break
      case 'SUBMITTED':
      case 'PENDING':
      case 'RESUBMITTED':
        if (gate.canApprove) out.push({ action: 'approve', label: 'Approve', tone: 'emerald' })
        if (gate.canReject) out.push({ action: 'reject', label: 'Reject', tone: 'rose' })
        if (gate.canReview) out.push({ action: 'review', label: 'Start Review', tone: 'amber' })
        break
      case 'UNDER_REVIEW':
        if (gate.canApprove) out.push({ action: 'approve', label: 'Approve', tone: 'emerald' })
        if (gate.canReject) out.push({ action: 'reject', label: 'Reject', tone: 'rose' })
        break
      case 'BU_APPROVED':
      case 'SUBSIDIARY_APPROVED':
      case 'HQ_REVIEW':
        if (gate.canApprove) out.push({ action: 'approve', label: s.status === 'HQ_REVIEW' ? 'Lock' : 'Approve', tone: 'emerald' })
        if (s.status === 'HQ_REVIEW' && gate.canLock) out.push({ action: 'lock', label: 'Lock', tone: 'slate' })
        break
      case 'CHANGES_REQUESTED':
      case 'REJECTED':
      case 'CORRECTION_REQUESTED':
        if (gate.canSubmit) out.push({ action: 'resubmit', label: 'Resubmit', tone: 'blue' })
        break
      case 'LOCKED':
      default:
        break
    }
    return out
  }

  const roleLabel = user?.roles?.[0]?.name ?? 'User'

  // ---------- Generate Report (select submission → pick format → download) ----------
  const reportCandidates = useMemo(() => {
    const q = reportSearch.trim().toLowerCase()
    const base = [...items].sort((a, b) =>
      (b.submittedAt || b.updatedAt || '').localeCompare(a.submittedAt || a.updatedAt || '')
    )
    if (!q) return base
    return base.filter(it =>
      [it.title, it.project?.projectName, it.reportingPeriod?.periodLabel, it.module, it.status, it.submittedBy]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [items, reportSearch])

  const downloadReport = useCallback(async (format: ReportFormat) => {
    if (!reportTarget) return
    const target = reportTarget
    if (format === 'html') {
      /* Print view — opens inline in a new tab with clickable evidence links;
         Save as PDF / Print straight from the browser toolbar in the preview. */
      window.open(`/api/pu/submissions/${target.id}/report?format=html`, '_blank', 'noopener')
      toast.success('Print view opened', {
        description: `Use "Print / Save as PDF" in the preview for ${target.title}.`,
      })
      return
    }
    setReportDownloading(format)
    try {
      const r = await fetch(`/api/pu/submissions/${target.id}/report?format=${format}`)
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `Report generation failed (${r.status})`)
      }
      const blob = await r.blob()
      const cd = r.headers.get('content-disposition') || ''
      const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/)
      const fileName = match
        ? decodeURIComponent(match[1])
        : `${target.title.replace(/[^\w.-]+/g, '-')}.${format === 'pdf' ? 'pdf' : format === 'excel' ? 'csv' : 'doc'}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded', { description: fileName })
    } catch (e) {
      toast.error('Report generation failed', { description: (e as Error).message })
    } finally {
      setReportDownloading(null)
    }
  }, [reportTarget])

  const closeReportFlow = useCallback(() => {
    setReportOpen(false)
    setReportStep('picker')
    setReportSearch('')
    setReportTarget(null)
    setReportDownloading(null)
  }, [])

  // Live KPI values from items & status counts
  const liveKpis = useMemo(() => {
    const totalComp = items.reduce((acc, it) => acc + (it.completionPct || 0), 0)
    const avgComp = items.length > 0 ? Math.round(totalComp / items.length) : 0
    return {
      reviewSubs: kpis?.reviewSubs ?? chipCounts.SUBMITTED,
      corrections: kpis?.corrections ?? chipCounts.CORRECTION_REQUIRED,
      draftSubs: kpis?.draftSubs ?? chipCounts.DRAFT,
      openExceptions: kpis?.openExceptions ?? items.reduce((acc, it) => acc + (it.validationErrors || 0), 0),
      approvedSubs: kpis?.approvedSubs ?? (chipCounts.APPROVED + chipCounts.LOCKED),
      completion: kpis?.completion ?? avgComp,
    }
  }, [kpis, items, chipCounts])

  // ---------- Render ----------
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="animate-fade-up stagger-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Submissions Workflow</h1>
            <span className="status-pill status-submitted">
              <ClipboardList className="h-3 w-3" /> {items.length} active
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Multi-level review pipeline · DRAFT → Submitted → Project Admin Review → Subsidiary → HQ → Locked. · Signed in as <span className="font-semibold text-slate-700">{roleLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => { setReportOpen(true); setReportStep('picker'); setReportTarget(null); setReportSearch('') }}
            className="btn-glass-primary flex items-center gap-1.5 self-start rounded-full px-4 py-2 text-xs font-semibold shadow-sm md:self-auto"
          >
            <FileText className="h-3.5 w-3.5" /> Generate Report
          </button>
          <button
            onClick={fetchList}
            className="glass-subtle flex items-center gap-1.5 self-start rounded-full px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white md:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {gate.canApprove && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-950 backdrop-blur-md">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-emerald-900">Project Admin Review Authority Active:</span> You are authorized to review submitted final reports from site data contributors (Environment, HR, EHS, Finance, Procurement, CSR, Compliance) and <span className="font-semibold text-emerald-800">Approve</span> or <span className="font-semibold text-rose-700">Reject</span> them with feedback.
          </div>
        </div>
      )}

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile delay={0.05} icon={Clock} tileClass="bg-amber-50 text-amber-600" label="Awaiting Review" value={liveKpis.reviewSubs} />
        <KpiTile delay={0.1} icon={AlertTriangle} tileClass="bg-rose-50 text-rose-600" label="Pending Corrections" value={liveKpis.corrections} />
        <KpiTile delay={0.15} icon={Files} tileClass="bg-blue-50 text-blue-600" label="Draft Submissions" value={liveKpis.draftSubs} />
        <KpiTile delay={0.2} icon={AlertOctagon} tileClass="bg-rose-50 text-rose-600" label="Validation Errors" value={liveKpis.openExceptions} />
        <KpiTile delay={0.25} icon={CheckCircle2} tileClass="bg-emerald-50 text-emerald-600" label="Approved Subs" value={liveKpis.approvedSubs} />
        <KpiTile delay={0.3} icon={FileCheck2} tileClass="bg-teal-50 text-teal-600" label="Completion" value={liveKpis.completion} unit="%" />
      </div>

      {/* STATUS CHIPS + FILTERS */}
      <div className="glass glass-shimmer animate-fade-up stagger-2 flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_CHIPS.map(c => {
            const active = chipFilter === c.key
            return (
              <button
                key={c.key}
                onClick={() => setChipFilter(c.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'btn-glass-primary shadow'
                    : 'glass-subtle text-slate-600 hover:bg-white'
                }`}
              >
                {c.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'
                }`}>
                  {chipCounts[c.key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Filter className="h-3.5 w-3.5" /> Filters:
          </div>
          <FilterSelect label="Project" value={projectId} onChange={setProjectId}
            options={projects.map(p => ({ value: p.id, label: p.name }))} />
          <FilterSelect label="Period" value={periodId} onChange={setPeriodId}
            options={[{ value: 'all', label: 'All periods' }, ...periods.map(p => ({ value: p.id, label: p.label }))]} />
          <FilterSelect label="Module" value={moduleKey} onChange={setModuleKey}
            options={[{ value: 'all', label: 'All modules' }, ...MODULE_OPTIONS.map(m => ({ value: m.value, label: m.label }))]} />
          {/* Calendar — find submissions by submitted date */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Submitted Date</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`glass-subtle flex w-full min-w-[160px] items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    calDate ? 'text-blue-700 ring-1 ring-blue-200' : 'text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <CalendarDays className={`h-3.5 w-3.5 shrink-0 ${calDate ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="truncate">
                      {calDate
                        ? dfnFormat(calDate, 'dd MMM yyyy')
                        : 'Calendar'}
                    </span>
                  </span>
                  {calDate ? (
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                        {dayTotalFor(calDate)}
                      </span>
                      <X
                        className="h-3 w-3 text-slate-400 hover:text-rose-500"
                        onClick={(e) => { e.stopPropagation(); setCalDate(undefined) }}
                      />
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                      {items.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3">
                <Calendar
                  mode="single"
                  selected={calDate}
                  onSelect={(d) => setCalDate(d)}
                  defaultMonth={calDefaultMonth}
                  className="w-fit"
                  classNames={{ day_button: 'h-7 w-7 text-[11px]' }}
                />
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {calDate
                      ? `${dayTotalFor(calDate)} submission${dayTotalFor(calDate) === 1 ? '' : 's'} on ${dfnFormat(calDate, 'dd MMM yyyy')}`
                      : `${items.length} submissions · click a date to filter`}
                  </span>
                  {calDate && (
                    <button
                      type="button"
                      onClick={() => { setCalDate(undefined); setCalOpen(false) }}
                      className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-200"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* TABLE / states */}
      {loading ? (
        <SubmissionsSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchList} />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <SubmissionsTable
          items={items}
          pagedItems={pagedItems}
          permittedActions={permittedActions}
          onOpen={openDetail}
          onAction={handleQuickAction}
          onApprove={(it) => { setApproveTarget(it); setApproveComment('') }}
          onReject={(it) => {
            setRejectTarget(it)
            setRejectFields([{ field: '', issue: '', severity: 'WARNING', comment: '' }])
            setRejectGeneral('')
          }}
          onGenerateReport={(it) => {
            setReportTarget(it)
            setReportStep('format')
            setReportOpen(true)
            setReportSearch('')
          }}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          clearSelection={clearSelection}
          sortKey={sortKey}
          sortDir={sortDir}
          toggleSort={toggleSort}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          safePage={safePage}
          setPage={setPage}
          setPageSize={(n) => { setPageSize(n); setPage(1) }}
          totalItems={sortedItems.length}
          onBulkExport={() => {
            const selected = items.filter(s => selectedIds.has(s.id))
            const csv = ['Project,Period,Module,Status,Completion,Evidence,Submitted'].concat(
              selected.map(s => `"${s.title}","${s.reportingPeriod?.periodLabel || ''}","${s.module}","${s.status}","${s.completionPct}%","${s.evidenceCount}","${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '-'}"`)
            ).join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `submissions-export-${Date.now()}.csv`; a.click()
            URL.revokeObjectURL(url)
            toast.success(`Exported ${selected.length} submission(s) to CSV`)
          }}
        />
      )}

      {/* DETAIL SHEET */}
      <Sheet open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) { setDetail(null); setDetailLoading(false); setDetailId(null) } }}>
        <SheetContent side="right" className="glass-strong w-full overflow-y-auto scroll-elegant p-0 sm:max-w-3xl">
          <SheetHeader className="border-b border-white/60 bg-white/40 p-5">
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Layers className="h-4 w-4 text-blue-600" />
              {detail?.submission.title ?? 'Submission Detail'}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Source records · evidence · validation · calculations · history · corrections
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex h-72 items-center justify-center">
              <MeilLoader size={68} label="Loading submission details…" />
            </div>
          ) : detail ? (
            <SubmissionDetailPanel
              detail={detail}
              gate={gate}
              permittedActions={permittedActions}
              onAction={handleQuickAction}
              onApprove={(it) => { setApproveTarget(it); setApproveComment('') }}
              onReject={(it) => {
                setRejectTarget(it)
                setRejectFields([{ field: '', issue: '', severity: 'WARNING', comment: '' }])
                setRejectGeneral('')
              }}
              onRefresh={refreshDetail}
              onOpenDataEntry={() => {
                setDetailOpen(false)
                setActiveModule('data-entry')
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* APPROVE DIALOG */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => { if (!o) { setApproveTarget(null); setApproveComment('') } }}>
        <DialogContent className="glass-strong rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Approve Submission
            </DialogTitle>
            <DialogDescription className="text-xs">
              Advancing <span className="font-semibold text-slate-700">{approveTarget?.title}</span> one level in the review pipeline.
            </DialogDescription>
          </DialogHeader>
          <PipelineStepper status={approveTarget?.status ?? ''} />
          <div className="space-y-1.5">
            <Label htmlFor="approveComment" className="text-xs font-semibold text-slate-600">
              Approval comment <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="approveComment"
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="e.g. Evidence verified, values consistent with meter readings."
              rows={3}
              className="bg-white/60"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => { setApproveTarget(null); setApproveComment('') }} className="text-slate-600">Cancel</Button>
            <Button onClick={submitApprove} disabled={approveBusy} className="btn-glass-primary rounded-full">
              {approveBusy ? <Ring className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Confirm Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT (correction request) DIALOG */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null) } }}>
        <DialogContent className="glass-strong max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <XCircle className="h-4 w-4 text-rose-600" /> Request Corrections
            </DialogTitle>
            <DialogDescription className="text-xs">
              Send <span className="font-semibold text-slate-700">{rejectTarget?.title}</span> back to the project team for fixes. Each field issue becomes a tracked CorrectionRequest.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto scroll-elegant pr-1">
            {rejectFields.map((f, idx) => (
              <div key={idx} className="glass-subtle space-y-2 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Issue #{idx + 1}</span>
                  {rejectFields.length > 1 && (
                    <button
                      onClick={() => setRejectFields(rejectFields.filter((_, i) => i !== idx))}
                      className="text-slate-400 transition hover:text-rose-500"
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase text-slate-500">Field</Label>
                    <Input
                      value={f.field}
                      onChange={(e) => {
                        const next = [...rejectFields]
                        next[idx] = { ...next[idx], field: e.target.value }
                        setRejectFields(next)
                      }}
                      placeholder="e.g. quantity"
                      className="h-8 bg-white/60 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase text-slate-500">Severity</Label>
                    <Select
                      value={f.severity}
                      onValueChange={(v) => {
                        const next = [...rejectFields]
                        next[idx] = { ...next[idx], severity: v }
                        setRejectFields(next)
                      }}
                    >
                      <SelectTrigger className="h-8 bg-white/60 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['INFO', 'WARNING', 'ERROR', 'BLOCKING'].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase text-slate-500">Issue</Label>
                  <Input
                    value={f.issue}
                    onChange={(e) => {
                      const next = [...rejectFields]
                      next[idx] = { ...next[idx], issue: e.target.value }
                      setRejectFields(next)
                    }}
                    placeholder="e.g. Quantity is negative."
                    className="h-8 bg-white/60 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase text-slate-500">Comment <span className="text-slate-400">(optional)</span></Label>
                  <Textarea
                    value={f.comment}
                    onChange={(e) => {
                      const next = [...rejectFields]
                      next[idx] = { ...next[idx], comment: e.target.value }
                      setRejectFields(next)
                    }}
                    placeholder="Guidance for the data owner…"
                    rows={2}
                    className="bg-white/60 text-xs"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={() => setRejectFields([...rejectFields, { field: '', issue: '', severity: 'WARNING', comment: '' }])}
              className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              <Plus className="h-3 w-3" /> Add another field
            </button>

            <div className="space-y-1.5 border-t border-white/60 pt-3">
              <Label className="text-xs font-semibold text-slate-600">General comment <span className="text-slate-400">(optional)</span></Label>
              <Textarea
                value={rejectGeneral}
                onChange={(e) => setRejectGeneral(e.target.value)}
                placeholder="High-level note for the project team…"
                rows={2}
                className="bg-white/60"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)} className="text-slate-600">Cancel</Button>
            <Button onClick={submitReject} disabled={rejectBusy} className="rounded-full bg-rose-500 text-white hover:bg-rose-600">
              {rejectBusy ? <Ring className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              Request Corrections
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GENERATE REPORT DIALOG — step 1: pick the submission, step 2: pick the format */}
      <Dialog open={reportOpen} onOpenChange={(o) => { if (!o) closeReportFlow() }}>
        <DialogContent className="glass-strong max-w-2xl rounded-2xl">
          {reportStep === 'picker' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-800">
                  <FileText className="h-4 w-4 text-blue-600" /> Generate Submission Report
                </DialogTitle>
                <DialogDescription className="text-xs">
                  <span className="font-bold text-blue-700">Step 1 of 2 —</span> select the submission to report on. The report contains the project details, reporting period, captured data, individual source records (incl. emission sources), evidence vault, validation, calculations, history & corrections.
                </DialogDescription>
              </DialogHeader>

              {/* Search + selectable submission cards */}
              <div className="glass-subtle flex items-center gap-2 rounded-xl px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <Input
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Search by title, project, period, module or status…"
                  className="h-7 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                />
                {reportSearch && (
                  <button onClick={() => setReportSearch('')} className="text-slate-400 transition hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-[46vh] space-y-1.5 overflow-y-auto scroll-elegant pr-1">
                {reportCandidates.length === 0 ? (
                  <div className="flex h-24 flex-col items-center justify-center gap-1 text-slate-400">
                    <Inbox className="h-5 w-5" />
                    <span className="text-xs font-semibold">No submissions match the search</span>
                  </div>
                ) : (
                  reportCandidates.map((s) => {
                    const isSel = reportTarget?.id === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setReportTarget(isSel ? null : s)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          isSel
                            ? 'border-blue-300 bg-blue-50/60 ring-2 ring-blue-200 shadow-sm'
                            : 'border-white/70 bg-white/60 hover:border-blue-200 hover:bg-white'
                        }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-sky-100 text-blue-600`}>
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-slate-800">{s.project.projectName}</span>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide ${moduleBadgeClass(s.module)}`}>
                              {s.module}
                            </span>
                            <span className={`status-pill ${statusPillClass(s.status)}`}>
                              {PIPELINE_LABEL[s.status] ?? s.status}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">
                            {s.title} · {s.reportingPeriod?.periodLabel} · {fmtDate(s.submittedAt)} · {s.evidenceCount} evidence
                          </div>
                        </div>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${isSel ? 'bg-blue-600 text-white' : 'bg-slate-100 text-transparent'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    )
                  })
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={closeReportFlow} className="text-slate-600">Cancel</Button>
                <Button
                  onClick={() => setReportStep('format')}
                  disabled={!reportTarget}
                  className="btn-glass-primary rounded-full"
                >
                  <FileText className="h-3.5 w-3.5" /> Generate Report
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-800">
                  <FileDown className="h-4 w-4 text-blue-600" /> Choose Export Format
                </DialogTitle>
                <DialogDescription className="text-xs">
                  <span className="font-bold text-blue-700">Step 2 of 2 —</span> download your preferred format for{' '}
                  <span className="font-semibold text-slate-700">{reportTarget?.project.projectName}</span>{' '}
                  <span className={`status-pill ${statusPillClass(reportTarget?.status ?? '')}`}>{PIPELINE_LABEL[reportTarget?.status ?? ''] ?? reportTarget?.status}</span>{' '}
                  <span className="text-slate-500">({reportTarget?.module} · {reportTarget?.reportingPeriod?.periodLabel})</span>
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {REPORT_FORMATS.map((f) => {
                  const Icon = f.icon
                  const busy = reportDownloading === f.format
                  return (
                    <button
                      key={f.format}
                      type="button"
                      disabled={reportDownloading !== null}
                      onClick={() => downloadReport(f.format)}
                      className="group flex flex-col items-start gap-2 rounded-xl border border-white/70 bg-white/70 p-3.5 text-left transition hover:border-blue-200 hover:bg-white hover:shadow-sm disabled:cursor-wait disabled:opacity-60"
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${f.iconBox}`}>
                        {busy ? <Ring className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {busy ? 'Preparing…' : f.label}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{f.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="ghost"
                  onClick={() => { if (reportDownloading === null) { setReportStep('picker') } }}
                  disabled={reportDownloading !== null}
                  className="text-slate-600"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button onClick={closeReportFlow} className="btn-glass-primary rounded-full">
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Building blocks
// ============================================================

function KpiTile({
  icon: Icon, tileClass, label, value, unit, delay,
}: {
  icon: React.ComponentType<{ className?: string }>
  tileClass: string
  label: string
  value: number
  unit?: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      className="glass glass-shimmer rounded-2xl p-4"
    >
      <div className="flex items-center justify-between">
        <div className={`kpi-tile ${tileClass}`}><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="tabular-nums text-2xl font-bold text-slate-800">{value}</span>
          {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
        </div>
      </div>
    </motion.div>
  )
}

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

function SubmissionsTable({
  items, pagedItems, permittedActions, onOpen, onAction, onApprove, onReject,
  onGenerateReport,
  selectedIds, toggleSelect, toggleSelectAll, clearSelection,
  sortKey, sortDir, toggleSort,
  page, pageSize, totalPages, safePage, setPage, setPageSize, totalItems,
  onBulkExport,
}: {
  items: SubmissionListItem[]
  pagedItems: SubmissionListItem[]
  permittedActions: (s: SubmissionListItem) => Array<{ action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock'; label: string; tone: 'blue' | 'emerald' | 'rose' | 'amber' | 'slate' }>
  onOpen: (id: string) => void
  onAction: (s: SubmissionListItem, action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock') => void
  onApprove: (s: SubmissionListItem) => void
  onReject: (s: SubmissionListItem) => void
  onGenerateReport: (s: SubmissionListItem) => void
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  toggleSelectAll: () => void
  clearSelection: () => void
  sortKey: string
  sortDir: 'asc' | 'desc'
  toggleSort: (key: any) => void
  page: number
  pageSize: number
  totalPages: number
  safePage: number
  setPage: (p: number) => void
  setPageSize: (n: number) => void
  totalItems: number
  onBulkExport: () => void
}) {
  const allOnPageSelected = pagedItems.length > 0 && pagedItems.every(s => selectedIds.has(s.id))
  const renderSortIcon = (col: string) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 inline h-2.5 w-2.5 text-slate-300" />
    return sortDir === 'asc' ? <ArrowUp className="ml-1 inline h-2.5 w-2.5 text-blue-500" /> : <ArrowDown className="ml-1 inline h-2.5 w-2.5 text-blue-500" />
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-2"
    >
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-2 flex items-center gap-3 rounded-xl bg-blue-50/70 px-4 py-2">
          <CheckSquare className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">{selectedIds.size} selected</span>
          <button onClick={onBulkExport} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:text-blue-600">
            <FileDown className="h-3 w-3" /> Export selected
          </button>
          <button onClick={clearSelection} className="ml-auto flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600">
            <X className="h-3 w-3" /> Clear
          </button>
        </motion.div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="border-white/40 hover:bg-transparent">
            <TableHead className="w-8 pl-3">
              <Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
            </TableHead>
            <TableHead className="cursor-pointer pl-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600" onClick={() => toggleSort('title')}>Project / Title {renderSortIcon('title')}</TableHead>
            <TableHead className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600" onClick={() => toggleSort('period')}>Period {renderSortIcon('period')}</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Module</TableHead>
            <TableHead className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600" onClick={() => toggleSort('completion')}>Completion {renderSortIcon('completion')}</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Validation</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Evidence</TableHead>
            <TableHead className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600" onClick={() => toggleSort('submittedAt')}>Submitted {renderSortIcon('submittedAt')}</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reviewer</TableHead>
            <TableHead className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600" onClick={() => toggleSort('status')}>Status {renderSortIcon('status')}</TableHead>
            <TableHead className="pr-4 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedItems.map((s, i) => {
            const actions = permittedActions(s)
            const isSelected = selectedIds.has(s.id)
            return (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.32), duration: 0.32 }}
                title="Click to view submission details"
                className={`group cursor-pointer border-b border-white/40 transition hover:bg-white/60 ${statusRowAccent(s.status)} ${isSelected ? 'bg-blue-50/40' : ''}`}
                onClick={() => onOpen(s.id)}
              >
                <TableCell className="px-3 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(s.id) }}>
                  <Checkbox checked={isSelected} aria-label={`Select ${s.title}`} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-sky-100 text-blue-600">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{s.project.projectName}</div>
                      <div className="truncate text-[10px] text-slate-400">{s.title}</div>
                      {s.parsedValues && s.parsedValues.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.parsedValues.slice(0, 2).map((pv, pIdx) => (
                            <span key={pIdx} className="inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.2 text-[9px] font-semibold text-sky-800 border border-sky-200/80 shadow-2xs">
                              {pv.label}: {pv.value} {pv.unit || ''}
                            </span>
                          ))}
                          {s.parsedValues.length > 2 && (
                            <span className="text-[9px] font-bold text-slate-400">+{s.parsedValues.length - 2} more</span>
                          )}
                        </div>
                      )}
                      {(s.status === 'CHANGES_REQUESTED' || s.status === 'REJECTED' || s.status === 'CORRECTION_REQUESTED') && s.reviewComment && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                          <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" />
                          <span className="truncate max-w-[280px]">Rejection Note: {s.reviewComment}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-xs text-slate-600">{s.reportingPeriod.periodLabel}</TableCell>
                <TableCell className="py-3 text-xs text-slate-600">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${moduleBadgeClass(s.module)}`}>
                    {s.module}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <div className="w-24">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="tabular-nums font-semibold">{s.completionPct.toFixed(0)}%</span>
                    </div>
                    <Progress value={s.completionPct} className="h-1.5 bg-slate-100" />
                  </div>
                </TableCell>
                <TableCell className="py-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{s.validationPassed} pass</span>
                    {s.validationErrors > 0 ? (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">{s.validationErrors} err</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">0 err</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Files className="h-3 w-3 text-slate-400" />
                    {s.evidenceCount}
                  </span>
                </TableCell>
                <TableCell className="py-3 text-xs text-slate-600 font-mono">{s.formattedDateTime || fmtDateTime(s.submittedAt)}</TableCell>
                <TableCell className="py-3 text-xs text-slate-600">
                  {(() => {
                    // history is newest-first; currentReviewer may be null for approved/locked.
                    // A SUBMIT/CREATE tail action is the contributor's own echo, not a reviewer —
                    // show '—' rather than falling back to the contributor's name.
                    const lastAction = s.history && s.history.length > 0 ? s.history[0] : null
                    const isContributorEcho = lastAction ? (lastAction.action === 'SUBMIT' || lastAction.action === 'CREATE') : false
                    const reviewer = s.currentReviewer
                      ?? (lastAction && !isContributorEcho ? { name: lastAction.actorName, email: lastAction.actorRole } : null)
                    return reviewer ? (
                      <div>
                        <div className="font-medium text-slate-700">{reviewer.name}</div>
                        <div className="text-[10px] text-slate-400">{reviewer.email}</div>
                      </div>
                    ) : <span className="text-slate-400">—</span>
                  })()}
                </TableCell>
                <TableCell className="py-3">
                  <span className={`status-pill ${statusPillClass(s.status)}`}>
                    {PIPELINE_LABEL[s.status] ?? s.status}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onGenerateReport(s)}
                      title="Generate report for this submission"
                      className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FileText className="h-3 w-3" /> Report
                    </button>
                    {actions.length === 0 ? (
                      <button
                        onClick={() => onOpen(s.id)}
                        className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                    ) : (
                      actions.map((a) => (
                        <button
                          key={a.action}
                          onClick={() => {
                            if (a.action === 'approve') onApprove(s)
                            else if (a.action === 'reject') onReject(s)
                            else onAction(s, a.action)
                          }}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition ${TONE_BTN[a.tone]}`}
                        >
                          {TONE_ICON[a.tone]}
                          {a.label}
                        </button>
                      ))
                    )}
                  </div>
                </TableCell>
              </motion.tr>
            )
          })}
        </TableBody>
      </Table>
      {/* Pagination controls */}
      <div className="flex items-center justify-between px-4 py-3 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} of {totalItems}</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 outline-none">
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let p = i + 1
            if (totalPages > 5) {
              if (safePage > 3) p = safePage - 2 + i
              if (safePage > totalPages - 2) p = totalPages - 4 + i
            }
            if (p < 1 || p > totalPages) return null
            return (
              <button key={p} onClick={() => setPage(p)}
                className={`flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[10px] font-semibold transition ${p === safePage ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                {p}
              </button>
            )
          })}
          <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

const TONE_BTN: Record<'blue' | 'emerald' | 'rose' | 'amber' | 'slate', string> = {
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
}

const TONE_ICON: Record<'blue' | 'emerald' | 'rose' | 'amber' | 'slate', React.ReactNode> = {
  blue: <Send className="h-3 w-3" />,
  emerald: <ShieldCheck className="h-3 w-3" />,
  rose: <XCircle className="h-3 w-3" />,
  amber: <Clock className="h-3 w-3" />,
  slate: <Lock className="h-3 w-3" />,
}

// ---------- Detail panel ----------

function SubmissionDetailPanel({
  detail, gate, permittedActions, onAction, onApprove, onReject, onRefresh, onOpenDataEntry,
}: {
  detail: SubmissionDetail
  gate: RoleGate
  permittedActions: (s: SubmissionListItem) => Array<{ action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock'; label: string; tone: 'blue' | 'emerald' | 'rose' | 'amber' | 'slate' }>
  onAction: (s: SubmissionListItem, action: 'submit' | 'review' | 'approve' | 'reject' | 'resubmit' | 'lock') => void
  onApprove: (s: SubmissionListItem) => void
  onReject: (s: SubmissionListItem) => void
  onRefresh: () => void
  /** Navigate to the Data Entry module in-app (single-route app — no /pu URL exists). */
  onOpenDataEntry?: () => void
}) {
  const s = detail.submission
  /* Evidence document currently open in the inline preview dialog — set when
     the user clicks any evidence chip (record items / Evidence tab). */
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceBrief | null>(null)
  const [galleryDocs, setGalleryDocs] = useState<MultiEvidenceDoc[] | null>(null)
  /* Full-window mirror review — opens on returned submissions and shows the
     admin's red marks + clarifications phase by phase (same window the admin used). */
  const [reviewOpen, setReviewOpen] = useState(false)
  const [mirrorModel, setMirrorModel] = useState<ReviewModel | null>(null)

  const openMultiEvidenceGallery = (sourceEvidence?: EvidenceBrief[]) => {
    const list = sourceEvidence && sourceEvidence.length > 0 ? sourceEvidence : detail?.evidence || []
    if (list.length === 0) {
      toast.info('No documents', { description: 'No attached evidence files found in the vault for this submission.' })
      return
    }
    const docs: MultiEvidenceDoc[] = list.map((e) => ({
      id: e.id,
      fileName: e.fileName,
      fileSize: (e as any).fileSize || (e as any).fileSizeBytes,
      documentType: e.documentType,
      mimeType: (e as any).mimeType,
      status: e.status,
      hash: (e as any).hash || (e as any).fileHash,
      previewUrl: `/api/pu/evidence/${e.id}/file`,
      downloadUrl: `/api/pu/evidence/${e.id}/file?download=true`,
      uploadedAt: e.createdAt,
      uploaderName: e.uploader?.name,
    }))
    setGalleryDocs(docs)
  }

  /* Resolve a display-name (e.g. from a staged item's evidenceFiles[]) to a
     downloadable evidence row. Exact match first, then substring containment. */
  const findEvidenceByName = (name: string): EvidenceBrief | undefined =>
    detail.evidence.find(e => e.fileName === name) ||
    detail.evidence.find(e => e.fileName.includes(name) || name.includes(e.fileName))
  const corrections = (detail.submission as unknown as { corrections?: Correction[] }).corrections
    ?? (Array.isArray((detail as unknown as { corrections?: Correction[] }).corrections)
      ? (detail as unknown as { corrections: Correction[] }).corrections
      : [])
  const actions = permittedActions(s)

  return (
    <div className="space-y-5 p-5">
      {/* REJECTION / CHANGES REQUESTED ALERT (WidgetKit Liquid Glass Style) */}
      {(s.status === 'CHANGES_REQUESTED' || s.status === 'REJECTED' || s.status === 'CORRECTION_REQUESTED') && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50/95 p-4 text-rose-950 shadow-md backdrop-blur-xl animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-200/90 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">
                  Action Required
                </span>
                <h4 className="text-sm font-bold text-rose-950">
                  Project Admin Requested Revisions / Rejected
                </h4>
              </div>
              <p className="mt-2 text-xs font-semibold text-rose-950 bg-white/90 p-3 rounded-xl border border-rose-200/90 shadow-2xs">
                "{s.reviewComment || 'Project Admin requested corrections and clarification on the entered figures before sign-off.'}"
              </p>
              {/* Full-window rejection review — same phase-by-phase layout the admin used */}
              <button
                type="button"
                onClick={() => {
                  setMirrorModel(buildReviewModelFromPuDetail(detail, s))
                  setReviewOpen(true)
                }}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-rose-700 active:scale-[0.99]"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Open Full Rejection Review — see exactly which sources were marked
              </button>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                <span className="text-rose-700">
                  Reviewed by: <strong>{s.currentReviewer?.name || 'Project Admin'}</strong> {s.reviewedAt ? `• ${fmtDateTime(s.reviewedAt)}` : ''}
                </span>
                {onOpenDataEntry ? (
                  <button
                    type="button"
                    onClick={onOpenDataEntry}
                    className="inline-flex items-center gap-1 font-bold text-rose-800 hover:text-rose-950 underline"
                  >
                    Open in Data Entry to Revise &rarr;
                  </button>
                ) : (
                  <a
                    href="/pu?tab=data-entry"
                    className="inline-flex items-center gap-1 font-bold text-rose-800 hover:text-rose-950 underline"
                  >
                    Open in Data Entry to Revise &rarr;
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIPELINE STEPPER */}
      <PipelineStepper status={s.status} large />

      {/* METADATA */}
      <div className="glass-subtle rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Submission Summary</h3>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <MetaRow label="Project" value={s.project.projectName} icon={Building2} />
          <MetaRow label="Period" value={s.reportingPeriod.periodLabel} icon={CalendarDays} />
          <MetaRow label="Module" value={s.module} icon={FolderOpen} />
          <MetaRow label="Status" value={PIPELINE_LABEL[s.status] ?? s.status} icon={CheckCircle2} />
          <MetaRow label="Submitted By" value={s.submittedBy} icon={Send} />
          <MetaRow label="Submitted At" value={fmtDate(s.submittedAt)} icon={CalendarDays} />
          <MetaRow label="Current Reviewer" value={s.currentReviewer?.name ?? '—'} icon={ShieldCheck} />
          <MetaRow label="Locked At" value={fmtDateTime(s.lockedAt)} icon={Lock} />
        </dl>
        {s.reviewComment && (
          <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase text-blue-700">Latest Review Comment</div>
            <div className="mt-0.5 text-xs text-blue-800">{s.reviewComment}</div>
          </div>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="Completion" value={`${s.completionPct.toFixed(0)}%`} />
          <MiniStat label="Evidence" value={s.evidenceCount} />
          <MiniStat label="Validation errors" value={s.validationErrors} />
        </div>
      </div>

      {/* CAPTURED DATA FIELDS BREAKDOWN (Apple Liquid Glass Card) */}
      {s.parsedValues && s.parsedValues.length > 0 && (
        <div className="rounded-2xl border border-sky-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Submitted Data Breakdown ({s.parsedValues.length} fields)
              </h4>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              Captured Record
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {s.parsedValues.map((field, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-xs shadow-2xs"
              >
                <span className="font-medium text-slate-600 truncate">{field.label}:</span>
                <span className="ml-2 font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                  {field.value} {field.unit || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ATTACHED EVIDENCE LIST (WidgetKit Sealed Pill) */}
      {s.evidenceList && s.evidenceList.length > 0 && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm backdrop-blur-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-950">
                Attached Verification Evidence ({s.evidenceList.length} documents)
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {s.evidenceList.length > 1 && (
                <button
                  type="button"
                  onClick={() => openMultiEvidenceGallery()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
                >
                  <Eye className="h-3.5 w-3.5" /> View All ({s.evidenceList.length})
                </button>
              )}
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 border border-emerald-200 shadow-2xs">
                SHA-256 Audit Sealed
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.evidenceList.map((doc, idx) => {
              const docName = typeof doc === 'string' ? doc : (doc as any)?.fileName || (doc as any)?.name || 'Evidence Document'
              const ev = findEvidenceByName(docName)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (ev) setPreviewEvidence(ev)
                    else toast.info('Preview unavailable', { description: `${docName} is not registered in the Evidence Vault for this submission yet.` })
                  }}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs transition hover:border-emerald-400 hover:bg-emerald-50/60 hover:shadow-xs"
                  title="Click to preview this evidence document"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="font-mono text-[11px] truncate max-w-[280px]">{docName}</span>
                  <span className="ml-1 rounded-md bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                    VERIFIED
                  </span>
                  <Eye className="h-3 w-3 text-emerald-500 shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* TABBED DETAIL */}
      <Tabs defaultValue="records" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 rounded-xl bg-white/40 p-1">
          <TabsTrigger value="records" className="text-xs">Source Records ({detail.sourceRecords.length})</TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs">Evidence ({detail.evidence.length})</TabsTrigger>
          <TabsTrigger value="validation" className="text-xs">Validation ({detail.validationResults.length})</TabsTrigger>
          <TabsTrigger value="calc" className="text-xs">Calculations ({detail.calculationResults.length})</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History ({detail.submission.history.length})</TabsTrigger>
          <TabsTrigger value="corrections" className="text-xs">Corrections ({corrections.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-3">
          <RecordGrid
            records={detail.sourceRecords}
            module={s.module}
            corrections={corrections}
            onOpenEvidence={(name) => {
              const ev = findEvidenceByName(name)
              if (ev) setPreviewEvidence(ev)
              else toast.info('Preview unavailable', { description: `${name} is not registered in the Evidence Vault for this submission yet.` })
            }}
            onOpenMultipleEvidence={(names) => {
              const matched = names.map(n => findEvidenceByName(n)).filter(Boolean) as EvidenceBrief[]
              if (matched.length > 0) openMultiEvidenceGallery(matched)
              else toast.info('Preview unavailable', { description: 'These evidence documents are not registered in the Evidence Vault yet.' })
            }}
          />
        </TabsContent>
        <TabsContent value="evidence" className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Attached Documents ({detail.evidence.length})
            </span>
            {detail.evidence.length > 1 && (
              <button
                type="button"
                onClick={() => openMultiEvidenceGallery(detail.evidence)}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
              >
                <Eye className="h-3.5 w-3.5" /> View All at Once ({detail.evidence.length})
              </button>
            )}
          </div>
          <EvidenceList evidence={detail.evidence} onOpen={setPreviewEvidence} />
        </TabsContent>
        <TabsContent value="validation" className="mt-3">
          <ValidationList results={detail.validationResults} />
        </TabsContent>
        <TabsContent value="calc" className="mt-3">
          <CalcList results={detail.calculationResults} />
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <HistoryTimeline history={detail.submission.history} />
        </TabsContent>
        <TabsContent value="corrections" className="mt-3">
          <CorrectionsList corrections={corrections} />
        </TabsContent>
      </Tabs>

      {/* INLINE EVIDENCE PREVIEW DIALOG (PDF / image rendered in place) */}
      <Dialog open={!!previewEvidence} onOpenChange={(o) => { if (!o) setPreviewEvidence(null) }}>
        <DialogContent className="glass-strong max-w-4xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span className="truncate">{previewEvidence?.fileName ?? 'Evidence Document'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewEvidence ? `${previewEvidence.documentType || 'Document'} · ${previewEvidence.status} · uploaded ${fmtDate(previewEvidence.createdAt)}${previewEvidence.uploader ? ` by ${previewEvidence.uploader.name}` : ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          {previewEvidence && <EvidenceFilePreview evidence={previewEvidence} />}
          <DialogFooter>
            {previewEvidence && (
              <a
                href={`/api/pu/evidence/${previewEvidence.id}/file?download=true`}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
            <Button variant="ghost" onClick={() => setPreviewEvidence(null)} className="text-slate-600">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MULTI-EVIDENCE GALLERY DIALOG (all evidence documents at once in sequence) */}
      {galleryDocs && (
        <MultiEvidenceGallery
          documents={galleryDocs}
          title={`${s.title} — Evidence Verification Gallery`}
          subtitle="All attached documents in sequence — inspect proofs side-by-side or scroll together"
          onClose={() => setGalleryDocs(null)}
        />
      )}

      {/* FULL-WINDOW REJECTION REVIEW (mirror mode — contributor sees the admin's marks) */}
      <SubmissionReviewWindow
        open={reviewOpen && !!mirrorModel}
        onClose={() => setReviewOpen(false)}
        model={mirrorModel}
        onDone={() => setReviewOpen(false)}
      />

      {/* ACTION BAR */}
      <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-2 border-t border-white/60 bg-white/70 px-5 py-3 backdrop-blur-md">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
        >
          <RotateCcw className="h-3 w-3" /> Refresh detail
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {gate.isReadOnly || actions.length === 0 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-500">
              {s.status === 'LOCKED' ? 'Submission locked' : 'No actions permitted for your role'}
            </span>
          ) : (
            actions.map((a) => (
              <button
                key={a.action}
                onClick={() => {
                  if (a.action === 'approve') onApprove(s)
                  else if (a.action === 'reject') onReject(s)
                  else onAction(s, a.action)
                }}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${TONE_BTN[a.tone]}`}
              >
                {TONE_ICON[a.tone]} {a.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function PipelineStepper({ status, large }: { status: string; large?: boolean }) {
  // Map CORRECTION_REQUESTED / RESUBMITTED onto the UNDER_REVIEW slot (they happen between SUBMITTED and BU_APPROVED)
  const visualStatus =
    status === 'CORRECTION_REQUESTED' || status === 'RESUBMITTED' ? 'UNDER_REVIEW' : status
  const activeIdx = PIPELINE.indexOf(visualStatus as typeof PIPELINE[number])

  return (
    <div className="flex items-center overflow-x-auto scroll-elegant pb-1">
      {PIPELINE.map((stage, i) => {
        const done = activeIdx > i
        const current = activeIdx === i
        const locked = stage === 'LOCKED' && status === 'LOCKED'
        return (
          <div key={stage} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex items-center justify-center rounded-full border ${
                  large ? 'h-9 w-9' : 'h-7 w-7'
                } transition ${
                  current || locked
                    ? 'border-blue-400 bg-blue-500 text-white shadow-md shadow-blue-200'
                    : done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                    : 'border-slate-200 bg-white/60 text-slate-400'
                }`}
              >
                {done && !current ? (
                  <CheckCircle2 className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                ) : locked ? (
                  <Lock className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                ) : (
                  <span className="text-[10px] font-bold">{i + 1}</span>
                )}
              </div>
              <span className={`whitespace-nowrap text-[10px] font-semibold ${current || locked ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
                {PIPELINE_LABEL[stage]}
              </span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={`mx-1 h-0.5 w-6 sm:w-10 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MetaRow({
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

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/40 px-2.5 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 tabular-nums text-sm font-bold text-slate-800">{value}</div>
    </div>
  )
}

function RecordGrid({
  records,
  module: mod,
  corrections = [],
  onOpenEvidence,
  onOpenMultipleEvidence,
}: {
  records: SourceRecordRow[]
  module: string
  corrections?: Correction[]
  onOpenEvidence?: (fileName: string) => void
  onOpenMultipleEvidence?: (fileNames: string[]) => void
}) {
  if (records.length === 0) return <EmptyBlock icon={ListChecks} text="No source records attached." />
  return (
    <div className="space-y-3">
      {records.map((r, i) => {
        const recItems = Array.isArray((r as any).data?.items) ? (r as any).data.items : []
        const levelName = (r as any).levelName || (r as any).data?.levelName || mod + ' record'
        const recStatus = (r as any).status || (r as any).data?.status
        const recCorrections = corrections.filter((c) => c.recordId === (r.id as string))
        const isRejected = recCorrections.length > 0 || recStatus === 'CORRECTION_REQUESTED'
        return (
          <div
            key={(r.id as string) || i}
            className={'rounded-2xl border overflow-hidden ' + (isRejected ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200/90 bg-white/80')}
          >
            <div className={'flex items-center justify-between gap-2 px-3.5 py-2.5 border-b ' + (isRejected ? 'border-rose-200 bg-rose-50/80' : 'border-slate-100 bg-gradient-to-r from-sky-50/80 to-blue-50/50')}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={'flex h-6 w-6 items-center justify-center rounded-lg text-white text-[10px] font-black shrink-0 ' + (isRejected ? 'bg-rose-600' : 'bg-gradient-to-br from-sky-600 to-blue-700')}>
                  {i + 1}
                </span>
                <span className="text-[11.5px] font-bold text-slate-800 truncate">{levelName}</span>
              </div>
              {recStatus && (
                <span className={'text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ' + (
                  recStatus === 'CORRECTION_REQUESTED'
                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                    : recStatus === 'ACTIVE' || recStatus === 'APPROVED'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-slate-600 bg-slate-50 border-slate-200'
                )}>
                  {String(recStatus).replace(/_/g, ' ')}
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">
              {recCorrections.length > 0 && recItems.length === 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2.5 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-rose-700">Rejected by Project Admin</div>
                  {recCorrections.map((c, ci) => (
                    <div key={c.id || ci} className="rounded-lg bg-white/90 border border-rose-200/80 px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-800">{c.field}</span>
                        <span className={'text-[9px] font-extrabold px-1.5 py-0.5 rounded ' + (c.severity === 'ERROR' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>{c.severity}</span>
                      </div>
                      <div className="text-[11px] text-slate-700 mt-0.5">{c.issue || c.comment}</div>
                      {c.requesterName && <div className="text-[9.5px] text-slate-400 mt-0.5">— {c.requesterName}</div>}
                    </div>
                  ))}
                </div>
              )}

              {recItems.length === 0 && recCorrections.length === 0 && (
                <div className="text-[11px] text-slate-500 italic px-1">No per-source items captured in this record.</div>
              )}

              {recItems.map((it: any, idx: number) => {
                const entries = itemFieldEntries(it)
                const evNames: string[] = Array.isArray(it.evidenceFiles)
                  ? it.evidenceFiles
                      .map((f: any) => (typeof f === 'string' ? f : f?.fileName || f?.name || ''))
                      .filter(Boolean)
                  : []
                const sourceName = String(it.energySource || it.waterSource || it.emissionSource || it.wasteCategory || it.permitConsentType || it.title || '')
                const itemCorr = recCorrections.filter((c) => (c.field || '').includes(sourceName) || sourceName === '' )
                const itemRejected = itemCorr.length > 0
                return (
                  <div key={it.id || idx} className={'rounded-xl border p-2.5 ' + (itemRejected ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60')}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={'flex h-5 w-5 items-center justify-center rounded-md text-white text-[9px] font-bold shrink-0 ' + (itemRejected ? 'bg-rose-600' : 'bg-slate-800')}>
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-slate-900 truncate">{itemTitle(it)}</span>
                      </div>
                      {itemRejected && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white shrink-0">⚑ Rejected</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {entries.map(([k, v]) => {
                        const blank = v === null || v === undefined || v === ''
                        return (
                          <div key={k} className={'flex justify-between items-center gap-1.5 px-2 py-1 rounded-lg border ' + (blank ? 'bg-slate-50/70 border-slate-200/60' : 'bg-white border-slate-200/80')}>
                            <span className="text-[9.5px] font-semibold text-slate-500 truncate">{fieldLabel(k)}</span>
                            <span className={'text-[10px] text-right ' + (blank ? 'text-slate-300 italic' : 'font-mono font-bold text-slate-900')}>{fmtValue(v)}</span>
                          </div>
                        )
                      })}
                    </div>
                    {evNames.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {evNames.length > 1 && onOpenMultipleEvidence && (
                          <button
                            type="button"
                            onClick={() => onOpenMultipleEvidence(evNames)}
                            className="inline-flex cursor-pointer items-center gap-1 px-2 py-0.5 rounded-md bg-violet-600 text-[9px] font-bold text-white transition hover:bg-violet-700 shadow-2xs"
                            title="View all attached evidence documents at once in sequence"
                          >
                            <Eye className="h-2.5 w-2.5" /> View All ({evNames.length})
                          </button>
                        )}
                        {evNames.map((f, fi) => (
                          <button
                            key={fi}
                            type="button"
                            onClick={() => onOpenEvidence?.(f)}
                            className="inline-flex cursor-pointer items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-800 transition hover:bg-emerald-100 hover:border-emerald-400"
                            title={`Click to preview ${typeof f === 'string' ? f : (f as any)?.fileName || (f as any)?.name || 'Evidence Document'}`}
                          >
                            <FolderOpen className="h-2.5 w-2.5" /> {typeof f === 'string' ? f : (f as any)?.fileName || (f as any)?.name || 'Evidence Document'} <Eye className="h-2.5 w-2.5 text-emerald-500" />
                          </button>
                        ))}
                      </div>
                    )}
                    {itemCorr.map((c, ci) => (
                      <div key={c.id || ci} className="mt-1.5 rounded-lg border border-rose-200 bg-white/95 px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-bold text-slate-800">{c.field}</span>
                          <span className={'text-[9px] font-extrabold px-1.5 py-0.5 rounded ' + (c.severity === 'ERROR' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>{c.severity}</span>
                        </div>
                        <div className="text-[11px] text-slate-700 mt-0.5">{c.issue || c.comment}</div>
                        {c.requesterName && <div className="text-[9.5px] text-slate-400 mt-0.5">— {c.requesterName}</div>}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EvidenceList({ evidence, onOpen }: { evidence: EvidenceBrief[]; onOpen?: (e: EvidenceBrief) => void }) {
  if (evidence.length === 0) return <EmptyBlock icon={Files} text="No evidence documents attached to this submission's source records." />
  return (
    <div className="space-y-1.5">
      {evidence.map((e, i) => (
        <motion.div
          key={e.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.04, 0.32) }}
          onClick={() => onOpen?.(e)}
          className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/40 px-3 py-2 transition hover:bg-white/70 hover:shadow-2xs"
          title={`Click to preview ${e.fileName}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FileCheck2 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-slate-700">{e.fileName}</div>
            <div className="text-[10px] text-slate-400">{e.uploader?.name ?? '—'} · {fmtDate(e.createdAt)}</div>
          </div>
          <span className={`status-pill ${statusPillClass(e.status)}`}>{e.status}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100">
            <Eye className="h-3 w-3" /> View
          </span>
        </motion.div>
      ))}
    </div>
  )
}

/* Renders an evidence file inline: iframe for PDFs (browser-native viewer),
   <img> for images, download fallback otherwise. */
function EvidenceFilePreview({ evidence }: { evidence: EvidenceBrief }) {
  const previewUrl = `/api/pu/evidence/${evidence.id}/file`
  const downloadUrl = `${previewUrl}?download=true`
  const name = (evidence.fileName || '').toLowerCase()
  const isPdf = name.endsWith('.pdf')
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)

  if (isPdf) {
    return <iframe src={previewUrl} title={evidence.fileName} className="h-[62vh] w-full rounded-xl border border-slate-200 bg-white" />
  }
  if (isImage) {
    return <img src={previewUrl} alt={evidence.fileName} className="max-h-[62vh] w-full rounded-xl border border-slate-200 bg-white object-contain p-2" />
  }
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 text-slate-500">
      <FileText className="h-8 w-8" />
      <span className="text-xs">No inline preview for this file type.</span>
      <a href={downloadUrl} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 underline">
        <Download className="h-3.5 w-3.5" /> Download to view
      </a>
    </div>
  )
}

function ValidationList({ results }: { results: ValidationResultRow[] }) {
  if (results.length === 0) return <EmptyBlock icon={CheckCircle2} text="No validation issues — every record passed." />
  return (
    <div className="space-y-1.5">
      {results.map((v, i) => (
        <motion.div
          key={v.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.04, 0.32) }}
          className="rounded-xl bg-white/40 px-3 py-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`h-3.5 w-3.5 ${
                v.severity === 'ERROR' || v.severity === 'BLOCKING' ? 'text-rose-500' :
                v.severity === 'WARNING' ? 'text-amber-500' : 'text-blue-500'
              }`} />
              <span className="font-mono text-[10px] text-slate-500">{v.ruleCode}</span>
              {v.field && <span className="text-[10px] text-slate-400">· {v.field}</span>}
            </div>
            <span className={`status-pill ${
              v.severity === 'ERROR' || v.severity === 'BLOCKING' ? 'status-error' :
              v.severity === 'WARNING' ? 'status-warning' : 'status-submitted'
            }`}>{v.severity}</span>
          </div>
          <div className="mt-1 text-xs text-slate-700">{v.message}</div>
        </motion.div>
      ))}
    </div>
  )
}

function CalcList({ results }: { results: CalcResultRow[] }) {
  if (results.length === 0) return <EmptyBlock icon={Calculator} text="No calculation results for this submission's records." />
  return (
    <div className="space-y-1.5">
      {results.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.04, 0.32) }}
          className="flex items-center justify-between rounded-xl bg-white/40 px-3 py-2"
        >
          <div className="flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] text-slate-500">{c.scope ?? '—'}</span>
            <span className="text-[10px] text-slate-400">· factor v{c.factorVersion ?? '—'}</span>
          </div>
          <div className="text-right">
            <div className="tabular-nums text-sm font-bold text-slate-800">
              {c.calculatedValue.toFixed(2)} <span className="text-[10px] text-slate-400">{c.resultUnit ?? ''}</span>
            </div>
            <div className="text-[10px] text-slate-400">{fmtDateTime(c.calculatedAt)}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function HistoryTimeline({ history }: { history: any[] }) {
  if (!history || history.length === 0) return <EmptyBlock icon={History} text="No status transitions yet." />
  return (
    <ol className="relative space-y-3 border-l border-white/60 pl-4">
      {history.map((h, i) => (
        <motion.li
          key={h.id || i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.05, 0.4) }}
          className="relative"
        >
          <span className="absolute -left-[18px] flex h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">{(h.action || '').replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-slate-400">{timeAgo(h.createdAt || h.at)}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {h.fromStatus && h.toStatus ? (
              <span>{PIPELINE_LABEL[h.fromStatus] ?? h.fromStatus} → {PIPELINE_LABEL[h.toStatus] ?? h.toStatus}</span>
            ) : (
              <span>{h.note || h.comment || 'Transition recorded'}</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">{h.actorName || h.actor || 'System'} · {h.actorRole || 'Project Admin'}</div>
          {(h.comment || h.note) && (
            <div className="mt-0.5 flex items-start gap-1 text-[11px] italic text-slate-500">
              <MessageSquare className="h-3 w-3 flex-shrink-0" />
              “{h.comment || h.note}”
            </div>
          )}
        </motion.li>
      ))}
    </ol>
  )
}

function CorrectionsList({ corrections }: { corrections: Correction[] }) {
  if (corrections.length === 0) return <EmptyBlock icon={CheckCircle2} text="No correction requests — clean submission." />
  return (
    <div className="space-y-1.5">
      {corrections.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.04, 0.32) }}
          className="rounded-xl bg-white/40 px-3 py-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-slate-500">{c.field}</span>
              <span className="text-[10px] text-slate-400">· {c.severity}</span>
            </div>
            <span className={`status-pill ${c.status === 'OPEN' ? 'status-warning' : 'status-approved'}`}>{c.status}</span>
          </div>
          <div className="mt-1 text-xs text-slate-700">{c.issue}</div>
          {c.comment && <div className="mt-0.5 text-[11px] italic text-slate-500">“{c.comment}”</div>}
          <div className="mt-0.5 text-[10px] text-slate-400">Requested by {c.requesterName} · {timeAgo(c.createdAt)}</div>
        </motion.div>
      ))}
    </div>
  )
}

function EmptyBlock({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="glass-subtle flex flex-col items-center gap-2 rounded-xl py-8 text-center">
      <Icon className="h-6 w-6 text-slate-400" />
      <span className="text-xs text-slate-500">{text}</span>
    </div>
  )
}

function SubmissionsSkeleton() {
  return (
    <div className="glass rounded-2xl p-4">
      <MeilBoxLoader boxHeight="min-h-[300px]" label="Loading submissions…" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load submissions</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">Retry</button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <Inbox className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No submissions match your filters</div>
        <div className="text-xs text-slate-500">Try clearing a filter or create a new submission from a source-record module.</div>
      </div>
    </div>
  )
}
