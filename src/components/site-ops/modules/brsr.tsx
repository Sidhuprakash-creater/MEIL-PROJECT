'use client'
/**
 * BRSR Module — config-driven BRSR reporting engine.
 *
 * Pulls REAL data from:
 *   GET /api/brsr/frameworks
 *   GET /api/brsr/readiness?frameworkId=
 *   GET /api/brsr/principles?frameworkId=
 *   GET /api/brsr/indicators?frameworkId=
 *   GET /api/brsr/preview/[id]
 *   POST /api/brsr/generate
 *   GET /api/reports?type=BRSR
 *
 * Nothing is hardcoded — every %, value, and indicator is resolved server-side.
 */
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  FileCheck2, ChevronDown, ChevronRight, Sparkles, AlertOctagon, AlertTriangle,
  CheckCircle2, Clock, ShieldCheck, Database, Link2, Calculator, GitBranch,
  Download, Eye, Loader2, Layers, ListChecks, RefreshCw, FileBarChart,
  ArrowRight, BookOpen, Building2, Hash, FileText, ChevronLeft, X
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { useApp } from '@/components/site-ops/context'

// ============================================================
// Types — mirror the API response shapes (a subset; permissive).
// ============================================================
interface FrameworkListItem {
  id: string
  name: string
  version: string
  reportingYear: number
  tier: string
  status: string
  counts: { sections: number; principles: number; questions: number; answers: number }
}

interface ReadinessResponse {
  framework: { id: string; name: string; version: string; reportingYear: number }
  overall: number
  bySection: Record<string, { total: number; ready: number; pct: number }>
  byPrinciple: Record<string, { total: number; ready: number; pct: number }>
  missingItems: Array<{ questionId: string; questionCode: string; questionText: string; section: string | null; principle: string | null; status: string }>
  pendingEvidence: number
  pendingApprovals: number
  totals: { questions: number; answers: number; readyWeight: number; totalWeight: number }
}

interface PrincipleRow {
  id: string
  code: string
  name: string
  title: string
  description: string | null
  questionCount: number
  answerRollup: { total: number; ready: number; missing: number; draft: number; readiness: number }
  questions: Array<{ id: string; questionCode: string; questionText: string; answerType: string; unit: string | null; mappingSource: string | null; evidenceRequired: boolean; sortOrder: number }>
}

interface IndicatorEntry {
  question: { id: string; questionCode: string; questionText: string; answerType: string; unit: string | null; evidenceRequired: boolean }
  section: { code: string; name: string } | null
  principle: { code: string; name: string } | null
  mappingSource: string | null
  resolvedValue: number | string | null
  resolvedUnit: string | null
  sourceRecordIds: string[]
  sourceRecordType: string | null
  status: string
  derivation: string | null
}

interface ReportListItem {
  id: string
  reportType: string
  reportingYear: number | null
  periodLabel: string | null
  scopeType: string | null
  scopeId: string | null
  scopeName: string | null
  generatedBy: string
  status: string
  fileName: string
  fileType: string
  version: number
  createdAt: string
}

interface PreviewSection {
  section: { code: string; name: string; description: string | null }
  items: Array<{
    question: { id: string; questionCode: string; questionText: string; answerType: string; unit: string | null; evidenceRequired: boolean; principle: { code: string; name: string } | null }
    value: number | string | null
    unit: string | null
    mappingSource: string | null
    sourceStatus: string
    derivation: string | null
    sourceRecordIds: string[]
    sourceRecordType: string | null
    answer: { id: string; sourceType: string; status: string; answerValue: string | null; numericValue: number | null; updatedAt: string } | null
    evidence: { id: string; fileName: string; status: string; verifiedAt: string | null; verifiedBy: string | null } | null
  }>
}

interface PreviewResponse {
  framework: { id: string; name: string; version: string; reportingYear: number; tier: string }
  scope: { scopeType: string | null; scopeId: string | null; reportingPeriodId: string | null }
  sections: PreviewSection[]
  principles: Array<{ code: string; name: string; title: string }>
}

// ============================================================
// Module
// ============================================================
export function BrsrModule() {
  const { user } = useApp()
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [frameworkId, setFrameworkId] = useState<string>('')
  const [reportingYear, setReportingYear] = useState<number>(2026)
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null)
  const [principles, setPrinciples] = useState<PrincipleRow[]>([])
  const [indicators, setIndicators] = useState<IndicatorEntry[]>([])
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C'>('A')
  const [expandedPrinciple, setExpandedPrinciple] = useState<string | null>(null)
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorEntry | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load frameworks list once
  useEffect(() => {
    fetch('/api/so/brsr/frameworks')
      .then(r => r.json())
      .then(d => {
        const list: FrameworkListItem[] = d.frameworks ?? []
        setFrameworks(list)
        if (list.length > 0) {
          setFrameworkId(list[0].id)
          setReportingYear(list[0].reportingYear)
        }
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Load readiness + principles + indicators when framework changes
  const loadFrameworkData = useCallback(async (fwId: string) => {
    if (!fwId) return
    setLoading(true)
    setError('')
    try {
      const [rd, pr, ind, reps] = await Promise.all([
        fetch(`/api/so/brsr/readiness?frameworkId=${fwId}`).then(r => r.json()),
        fetch(`/api/so/brsr/principles?frameworkId=${fwId}`).then(r => r.json()),
        fetch(`/api/so/brsr/indicators?frameworkId=${fwId}`).then(r => r.json()),
        fetch('/api/so/reports?type=BRSR').then(r => r.json()),
      ])
      setReadiness(rd.framework ? (rd as ReadinessResponse) : null)
      setPrinciples((pr as { principles: PrincipleRow[] }).principles ?? [])
      setIndicators((ind as { indicators: IndicatorEntry[] }).indicators ?? [])
      setReports((reps as { reports: ReportListItem[] }).reports ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load BRSR data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (frameworkId) loadFrameworkData(frameworkId)
  }, [frameworkId, loadFrameworkData])

  // Generate BRSR report
  const handleGenerate = async () => {
    if (!frameworkId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/so/brsr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameworkId,
          reportingYear,
          scopeType: 'GROUP',
          scopeId: null,
          scopeName: 'MEIL Group (All)',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.error ? `${data.error}${data.detail ? ' — ' + data.detail : ''}` : 'Generate failed'
        if (res.status === 403) {
          toast.error('Permission required', { description: 'You need the brsr.generate permission to generate a BRSR report.' })
        } else {
          toast.error(msg)
        }
      } else {
        const downloadUrl = `/api/so/reports/${data.report.id}/download`
        const viewUrl = `/api/so/reports/${data.report.id}/download?inline=true`
        const pdfFileName = data.report?.fileName || `MEIL-BRSR-Annexure-I-FY${reportingYear}-v${data.report?.version || 1}.pdf`

        // 1. Trigger browser file download with exact .pdf extension
        const a = document.createElement('a')
        a.href = downloadUrl
        a.setAttribute('download', pdfFileName)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // 2. Open PDF in a new tab so user can immediately view, inspect and print all pages
        try {
          window.open(viewUrl, '_blank')
        } catch (wErr) {
          console.warn('Popup blocked for preview tab', wErr)
        }

        toast.success('BRSR Report Generated & Downloaded', {
          description: `SEBI Annexure I · v${data.report?.version} · ${pdfFileName}`,
        })
        // Refresh reports
        const reps = await fetch('/api/so/reports?type=BRSR').then(r => r.json())
        setReports((reps as { reports: ReportListItem[] }).reports ?? [])
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Network error')
    } finally {
      setGenerating(false)
    }
  }

  // Open preview
  const handleOpenPreview = async () => {
    if (!frameworkId) return
    setPreviewOpen(true)
    setLoadingPreview(true)
    setPreview(null)
    try {
      const data = await fetch(`/api/so/brsr/preview/${frameworkId}`).then(r => r.json())
      setPreview(data as PreviewResponse)
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const sectionIndicators = indicators.filter(i => i.section?.code === activeSection)

  if (loading) return <BrsrSkeleton />
  if (error && !readiness) {
    return <ErrorState message={error} onRetry={() => frameworkId && loadFrameworkData(frameworkId)} />
  }
  if (!frameworkId) {
    return <EmptyState icon={FileCheck2} title="No BRSR frameworks configured" description="Ask an admin to seed a BRSR framework (BRSR v3 FY2026) to begin." />
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">BRSR Reporting</h1>
            <span className="status-pill status-approved"><CheckCircle2 className="h-3 w-3" /> Live</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Config-driven BRSR v3 engine · Every value resolved from approved source records · No hardcoded content.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="so-glass-subtle flex items-center gap-2 rounded-full px-3 py-2 text-xs">
            <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
            <select
              value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none"
            >
              {frameworks.map(f => (
                <option key={f.id} value={f.id}>{f.name} {f.version} · FY{f.reportingYear}</option>
              ))}
            </select>
          </div>
          <div className="so-glass-subtle flex items-center gap-2 rounded-full px-3 py-2 text-xs">
            <span className="font-medium text-slate-500">Year</span>
            <input
              type="number"
              value={reportingYear}
              onChange={(e) => setReportingYear(Number(e.target.value))}
              className="w-16 bg-transparent font-semibold text-slate-700 outline-none tabular-nums"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-so-glass-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate BRSR Report
          </button>
        </div>
      </div>

      {/* READINESS HERO */}
      {readiness && (
        <ReadinessHero readiness={readiness} />
      )}

      {/* SECTION TABS + INDICATOR EXPLORER */}
      <div className="so-glass so-glass-shimmer rounded-2xl p-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Indicator Explorer</h3>
            <span className="status-pill status-submitted">{sectionIndicators.length} indicators</span>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-white/50 p-1">
            {(['A', 'B', 'C'] as const).map(s => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeSection === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Section {s}
              </button>
            ))}
          </div>
        </div>

        {/* Section description strip */}
        <div className="mb-3 rounded-xl bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
          {activeSection === 'A' && <><strong>Section A:</strong> General Disclosures — entity identity, reporting boundary, and corporate profile.</>}
          {activeSection === 'B' && <><strong>Section B:</strong> Management &amp; Process — governance, policy, and methodology.</>}
          {activeSection === 'C' && <><strong>Section C:</strong> Principle-wise Performance — P1–P9 ESG indicator disclosures.</>}
        </div>

        {/* Section C: Principle cards */}
        {activeSection === 'C' ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {principles.map((p, i) => (
              <PrincipleCard
                key={p.id}
                principle={p}
                expanded={expandedPrinciple === p.id}
                onToggle={() => setExpandedPrinciple(expandedPrinciple === p.id ? null : p.id)}
                delay={i * 0.04}
              />
            ))}
          </div>
        ) : (
          <IndicatorTable
            indicators={sectionIndicators}
            onSelect={setSelectedIndicator}
          />
        )}
      </div>

      {/* REPORT HISTORY */}
      <div className="so-glass so-glass-shimmer rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">BRSR Report History</h3>
            <span className="status-pill status-submitted">{reports.length} generated</span>
          </div>
          <button
            onClick={handleOpenPreview}
            className="so-glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white"
          >
            <Eye className="h-3 w-3" /> Preview Framework
          </button>
        </div>
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white/30 py-8 text-center">
            <FileBarChart className="h-8 w-8 text-slate-300" />
            <div className="text-xs font-semibold text-slate-500">No BRSR reports generated yet</div>
            <div className="text-[11px] text-slate-400">Click "Generate BRSR Report" above to produce the first version.</div>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-elegant">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2 font-semibold">Version</th>
                  <th className="px-2 py-2 font-semibold">Scope</th>
                  <th className="px-2 py-2 font-semibold">Year</th>
                  <th className="px-2 py-2 font-semibold">Generated By</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Created</th>
                  <th className="px-2 py-2 font-semibold text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-b border-slate-100/60 transition hover:bg-white/40">
                    <td className="px-2 py-2 font-semibold text-slate-700 tabular-nums">v{r.version}</td>
                    <td className="px-2 py-2 text-slate-600">{r.scopeName ?? r.scopeType ?? 'Group'}</td>
                    <td className="px-2 py-2 text-slate-600 tabular-nums">FY{r.reportingYear ?? '—'}</td>
                    <td className="px-2 py-2 text-slate-600">{r.generatedBy}</td>
                    <td className="px-2 py-2">
                      <span className={`status-pill ${statusPillClass(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-500 tabular-nums">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/so/reports/${r.id}/download?inline=true`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                          title="Open PDF directly in browser"
                        >
                          <Eye className="h-3 w-3" /> View
                        </a>
                        <a
                          href={`/api/so/reports/${r.id}/download`}
                          download={r.fileName || `MEIL-BRSR-Annexure-I-FY${r.reportingYear ?? 2026}-v${r.version}.pdf`}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
                          title="Download PDF to computer"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INDICATOR DETAIL SHEET */}
      <Sheet open={!!selectedIndicator} onOpenChange={(o) => !o && setSelectedIndicator(null)}>
        <SheetContent side="right" className="so-glass-strong w-full overflow-y-auto scroll-elegant sm:max-w-lg">
          {selectedIndicator && <IndicatorDetail indicator={selectedIndicator} />}
        </SheetContent>
      </Sheet>

      {/* PREVIEW DIALOG */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="so-glass-strong max-h-[88vh] overflow-y-auto scroll-elegant sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Eye className="h-4 w-4 text-blue-600" /> BRSR Report Preview
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Live resolved values from approved source records — what the regulator will see.
            </DialogDescription>
          </DialogHeader>
          {loadingPreview ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Resolving indicators from source data…
            </div>
          ) : preview ? (
            <PreviewBody preview={preview} />
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">No preview available</div>
          )}
        </DialogContent>
      </Dialog>

      {/* ROLE NOTICE */}
      {user && (
        <div className="so-glass-subtle flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span>View-only mode — BRSR report generation requires the <code>brsr.generate</code> permission.</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================
function ReadinessHero({ readiness }: { readiness: ReadinessResponse }) {
  const [expanded, setExpanded] = useState(false)
  const overall = readiness.overall ?? 0
  const circ = 2 * Math.PI * 52
  const offset = circ - (overall / 100) * circ

  const dimensions = [
    { label: 'Source completeness', value: readiness.totals.totalWeight > 0 ? Math.round((readiness.totals.readyWeight / readiness.totals.totalWeight) * 1000) / 10 : 0, icon: Database, tone: 'blue' },
    { label: 'Answer coverage', value: readiness.totals.questions > 0 ? Math.round((readiness.totals.answers / readiness.totals.questions) * 1000) / 10 : 0, icon: ListChecks, tone: 'cyan' },
    { label: 'Missing items', value: readiness.missingItems.length, icon: AlertTriangle, tone: 'rose' },
    { label: 'Pending evidence', value: readiness.pendingEvidence, icon: Link2, tone: 'amber' },
    { label: 'Pending approvals', value: readiness.pendingApprovals, icon: Clock, tone: 'violet' },
    { label: 'Ready / Total', value: `${readiness.totals.readyWeight} / ${readiness.totals.totalWeight}`, icon: CheckCircle2, tone: 'emerald' },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="so-glass so-glass-shimmer rounded-2xl p-5"
    >
      <div className="grid items-center gap-5 md:grid-cols-[200px,1fr]">
        {/* Radial progress */}
        <div className="flex flex-col items-center">
          <div className="relative h-40 w-40">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="10" />
              <motion.circle
                cx="60" cy="60" r="52" fill="none" stroke="url(#brsrGrad)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
              <defs>
                <linearGradient id="brsrGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="tabular-nums text-3xl font-bold text-slate-800">{overall}<span className="text-base text-slate-400">%</span></div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">BRSR Readiness</div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-600 transition hover:text-blue-700"
          >
            {expanded ? 'Hide unresolved items' : 'Show unresolved items'}
            <ChevronDown className={`h-3 w-3 transition ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dimensions grid */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Readiness Dimensions</h3>
              <p className="text-[11px] text-slate-500">Computed from <code>BrsrAnswer.status</code> fields — no hardcoded values.</p>
            </div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {Object.entries(readiness.bySection).map(([code, s]) => (
                <div key={code} className="rounded-lg bg-white/60 px-2 py-1 text-slate-600">
                  <span className="font-semibold text-slate-700">Sec {code}</span>
                  <span className="ml-1 tabular-nums font-bold text-blue-600">{s.pct}%</span>
                  <span className="ml-1 text-slate-400">({s.ready}/{s.total})</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {dimensions.map((d) => (
              <DimensionTile key={d.label} {...d} />
            ))}
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 overflow-hidden"
              >
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Unresolved Items ({readiness.missingItems.length})
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto scroll-elegant pr-1">
                    {readiness.missingItems.length === 0 ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> All BRSR indicators ready.
                      </div>
                    ) : readiness.missingItems.map(m => (
                      <div key={m.questionId} className="flex items-center justify-between rounded-lg bg-white/50 px-2 py-1.5 text-[11px]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">{m.questionCode}</span>
                          <span className="truncate text-slate-600">{m.questionText}</span>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {m.section && <span className="text-[10px] text-slate-400">Sec {m.section}</span>}
                          {m.principle && <span className="text-[10px] text-slate-400">{m.principle}</span>}
                          <span className={`status-pill ${statusPillClass(m.status)}`}>{m.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  )
}

function DimensionTile({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: string }) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-50 text-slate-600',
  }
  return (
    <div className="rounded-xl bg-white/40 px-2.5 py-2">
      <div className="flex items-center justify-between">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${toneMap[tone] ?? toneMap.slate}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="tabular-nums text-base font-bold text-slate-800">{value}</span>
      </div>
      <div className="mt-1 text-[10px] font-medium text-slate-500">{label}</div>
    </div>
  )
}

function PrincipleCard({ principle, expanded, onToggle, delay }: { principle: PrincipleRow; expanded: boolean; onToggle: () => void; delay: number }) {
  const r = principle.answerRollup
  const pct = r.readiness ?? 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-white/60 bg-white/55 p-3 backdrop-blur transition hover:bg-white/70"
    >
      <button onClick={onToggle} className="flex w-full items-start justify-between text-left">
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <span className="text-[11px] font-bold">{principle.code}</span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-slate-800">{principle.name}</div>
            <div className="mt-0.5 text-[10px] text-slate-500">{principle.title}</div>
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition ${expanded ? 'rotate-90' : ''}`} />
      </button>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay }}
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
          />
        </div>
        <span className="tabular-nums text-xs font-bold text-slate-700">{pct}%</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {principle.questionCount} Q</span>
        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {r.ready} ready</span>
        {r.missing > 0 && <span className="flex items-center gap-1 text-rose-600"><AlertTriangle className="h-3 w-3" /> {r.missing} missing</span>}
        {r.draft > 0 && <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3" /> {r.draft} draft</span>}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 overflow-hidden"
          >
            <div className="space-y-1.5 rounded-xl bg-white/60 p-2">
              {principle.questions.map(q => (
                <div key={q.id} className="rounded-lg bg-white/60 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">{q.questionCode}</span>
                      <span className="truncate text-[11px] text-slate-700">{q.questionText}</span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {q.mappingSource && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">{q.mappingSource}</span>}
                      {q.evidenceRequired && <ShieldCheck className="h-3 w-3 text-violet-500" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function IndicatorTable({ indicators, onSelect }: { indicators: IndicatorEntry[]; onSelect: (i: IndicatorEntry) => void }) {
  if (indicators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white/30 py-8 text-center">
        <ListChecks className="h-8 w-8 text-slate-300" />
        <div className="text-xs font-semibold text-slate-500">No indicators in this section</div>
        <div className="text-[11px] text-slate-400">Switch sections or pick a different framework.</div>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto scroll-elegant">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-wide text-slate-400">
            <th className="px-2 py-2 font-semibold">Code</th>
            <th className="px-2 py-2 font-semibold">Question</th>
            <th className="px-2 py-2 font-semibold">Type</th>
            <th className="px-2 py-2 font-semibold">Mapping Source</th>
            <th className="px-2 py-2 font-semibold text-right">Resolved Value</th>
            <th className="px-2 py-2 font-semibold">Source Status</th>
            <th className="px-2 py-2 font-semibold">Evidence</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind, i) => (
            <motion.tr
              key={ind.question.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onSelect(ind)}
              className="cursor-pointer border-b border-slate-100/60 transition hover:bg-white/50"
            >
              <td className="px-2 py-2">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">{ind.question.questionCode}</span>
              </td>
              <td className="px-2 py-2 text-slate-700">{ind.question.questionText}</td>
              <td className="px-2 py-2 text-slate-500">{ind.question.answerType}</td>
              <td className="px-2 py-2">
                {ind.mappingSource ? (
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{ind.mappingSource}</code>
                ) : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {ind.resolvedValue !== null ? (
                  <span className="font-bold text-slate-800">{formatValue(ind.resolvedValue)}</span>
                ) : <span className="text-slate-400">—</span>}
                {ind.resolvedUnit && <span className="ml-1 text-[10px] text-slate-400">{ind.resolvedUnit}</span>}
              </td>
              <td className="px-2 py-2">
                <span className={`status-pill ${indicatorStatusPill(ind.status)}`}>{ind.status}</span>
              </td>
              <td className="px-2 py-2">
                {ind.question.evidenceRequired ? (
                  <span className="status-pill status-violet" style={{ background: 'rgba(168,85,247,0.12)', color: 'rgb(109,40,217)', borderColor: 'rgba(168,85,247,0.25)' }}>
                    <ShieldCheck className="h-3 w-3" /> Required
                  </span>
                ) : <span className="text-slate-400 text-[10px]">Optional</span>}
              </td>
              <td className="px-2 py-2 text-right">
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IndicatorDetail({ indicator }: { indicator: IndicatorEntry }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700">{indicator.question.questionCode}</span>
          <span className={`status-pill ${indicatorStatusPill(indicator.status)}`}>{indicator.status}</span>
        </div>
        <h2 className="mt-2 text-base font-bold text-slate-800">{indicator.question.questionText}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {indicator.section && <span>Section {indicator.section.code} · {indicator.section.name}</span>}
          {indicator.principle && <span> · {indicator.principle.code} — {indicator.principle.name}</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DetailTile label="Answer Type" value={indicator.question.answerType} icon={BookOpen} />
        <DetailTile label="Unit" value={indicator.question.unit ?? '—'} icon={Hash} />
        <DetailTile label="Mapping Source" value={indicator.mappingSource ?? '—'} icon={GitBranch} mono />
        <DetailTile label="Source Record Type" value={indicator.sourceRecordType ?? '—'} icon={Database} />
      </div>

      <div className="rounded-xl border border-blue-200/50 bg-blue-50/40 p-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-blue-700">
          <Sparkles className="h-3.5 w-3.5" /> Resolved Value
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="tabular-nums text-3xl font-bold text-slate-800">
            {indicator.resolvedValue !== null ? formatValue(indicator.resolvedValue) : '—'}
          </span>
          {indicator.resolvedUnit && <span className="text-sm text-slate-500">{indicator.resolvedUnit}</span>}
        </div>
        {indicator.derivation && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-600">
            <Calculator className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-500" />
            <span>{indicator.derivation}</span>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Source Record Lineage</div>
        {indicator.sourceRecordIds.length === 0 ? (
          <div className="rounded-xl bg-white/40 px-3 py-3 text-xs text-slate-500">No source records contributed (manual disclosure or no mapping).</div>
        ) : (
          <div className="space-y-1">
            {indicator.sourceRecordIds.map((rid, idx) => (
              <div key={rid} className="flex items-center gap-2 rounded-lg bg-white/50 px-2.5 py-1.5 text-[11px]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{idx + 1}</span>
                <code className="font-mono text-[10px] text-slate-600">{rid}</code>
                <ArrowRight className="h-3 w-3 text-slate-300" />
                <span className="text-slate-500">{indicator.sourceRecordType ?? 'record'}</span>
                <a
                  href={`/api/so/audit/trace/${rid}?type=${traceTypeFor(indicator.sourceRecordType)}`}
                  onClick={(e) => { e.preventDefault(); window.open(`/api/so/audit/trace/${rid}?type=${traceTypeFor(indicator.sourceRecordType)}`, '_blank') }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"
                >
                  <GitBranch className="h-2.5 w-2.5" /> Trace
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailTile({ label, value, icon: Icon, mono }: { label: string; value: string; icon: any; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-white/40 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-xs font-semibold text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function PreviewBody({ preview }: { preview: PreviewResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50/40 px-3 py-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">{preview.framework.name} {preview.framework.version}</span>
        <span>·</span>
        <span>FY {preview.framework.reportingYear}</span>
        <span>·</span>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{preview.framework.tier}</span>
        <span>·</span>
        <span className="text-slate-500">{preview.sections.length} sections</span>
      </div>
      {preview.sections.map(sec => (
        <div key={sec.section.code} className="rounded-2xl border border-white/60 bg-white/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Section {sec.section.code}: {sec.section.name}</div>
              {sec.section.description && <div className="text-[10px] text-slate-500">{sec.section.description}</div>}
            </div>
          </div>
          <div className="space-y-1">
            {sec.items.map(item => (
              <div key={item.question.id} className="rounded-lg bg-white/60 px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">{item.question.questionCode}</span>
                    <span className="text-[11px] text-slate-700">{item.question.questionText}</span>
                  </div>
                  <span className={`status-pill ${indicatorStatusPill(item.sourceStatus)}`}>{item.sourceStatus}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {item.value !== null ? formatValue(item.value) : '—'}
                  </span>
                  {item.unit && <span>{item.unit}</span>}
                  {item.mappingSource && <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-500">{item.mappingSource}</code>}
                  {item.sourceRecordIds.length > 0 && <span>· {item.sourceRecordIds.length} source records</span>}
                  {item.evidence && (
                    <span className="status-pill status-verified">
                      <Link2 className="h-2.5 w-2.5" /> {item.evidence.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// States + helpers
// ============================================================
function BrsrSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200/60" />
      <div className="so-glass h-48 animate-pulse rounded-2xl" />
      <div className="so-glass h-96 animate-pulse rounded-2xl" />
      <div className="so-glass h-40 animate-pulse rounded-2xl" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="so-glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load BRSR module</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-so-glass-primary rounded-full px-5 py-2 text-xs font-semibold">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="so-glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <Icon className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  )
}

function statusPillClass(status: string): string {
  const m: Record<string, string> = {
    COMPLETED: 'status-approved',
    PROCESSING: 'status-submitted',
    FAILED: 'status-error',
    DRAFT: 'status-draft',
    APPROVED: 'status-approved',
    LOCKED: 'status-locked',
    SUBMITTED: 'status-submitted',
    MISSING: 'status-missing',
    EVIDENCE_VERIFIED: 'status-verified',
    UNDER_REVIEW: 'status-review',
    RESOLVED: 'status-approved',
    MISSING_SOURCE: 'status-missing',
    MANUAL: 'status-warning',
    NO_MAPPING: 'status-missing',
  }
  return m[status] ?? 'status-draft'
}

function indicatorStatusPill(status: string): string {
  return statusPillClass(status)
}

function formatValue(v: number | string): string {
  if (typeof v === 'number') {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(v)
}

function traceTypeFor(recordType: string | null): string {
  if (!recordType) return ''
  const t = recordType.toLowerCase()
  if (t.includes('energy')) return 'EnergyRecord'
  if (t.includes('water')) return 'WaterRecord'
  if (t.includes('waste')) return 'WasteRecord'
  if (t.includes('workforce') || t.includes('people')) return 'WorkforceRecord'
  if (t.includes('safety')) return 'SafetyRecord'
  if (t.includes('travel')) return 'TravelRecord'
  if (t.includes('subsidiary')) return 'Submission'
  return ''
}
