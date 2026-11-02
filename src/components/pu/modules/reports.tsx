'use client'
/**
 * Reports Module — generate, list, and download ESG & BRSR reports.
 *
 * Endpoints used:
 *   GET  /api/reports?type=&year=        — list reports
 *   GET  /api/reports/[id]               — report detail (content JSON parsed)
 *   POST /api/reports/generate           — generate module report (CSV)
 *   POST /api/brsr/generate              — generate BRSR report (JSON)
 *   GET  /api/reports/[id]/download      — download file (CSV / TXT)
 */
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  FileBarChart, FileText, Sparkles, AlertOctagon, RefreshCw, Download,
  Loader2, ChevronRight, Filter, Calendar, Building2, Hash, Layers,
  Eye, FileCheck2, History, ListChecks, Database, GitBranch
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { useApp } from '@/lib/pu/auth-context'

// ============================================================
// Types
// ============================================================
interface ReportRow {
  id: string
  reportType: string
  frameworkId: string | null
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

interface ReportDetail extends ReportRow {
  content: unknown
}

// ============================================================
// Module
// ============================================================
export function ReportsModule() {
  const { user } = useApp()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterYear, setFilterYear] = useState<string>('')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [selected, setSelected] = useState<ReportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filterType !== 'ALL') params.set('type', filterType)
      if (filterYear) params.set('year', filterYear)
      const data = await fetch(`/api/pu/reports?${params.toString()}`).then(r => r.json())
      setReports((data as { reports: ReportRow[] }).reports ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [filterType, filterYear])

  useEffect(() => { load() }, [load])

  const handleOpenDetail = async (r: ReportRow) => {
    setSelected(null)
    setDetailLoading(true)
    try {
      const data = await fetch(`/api/pu/reports/${r.id}`).then(r => r.json())
      setSelected(data.report as ReportDetail)
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load report')
    } finally {
      setDetailLoading(false)
    }
  }

  const onGenerated = async () => {
    setGenerateOpen(false)
    await load()
  }

  if (loading) return <ReportsSkeleton />
  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Reports</h1>
            <span className="status-pill status-approved"><FileCheck2 className="h-3 w-3" /> {reports.length} on file</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Generate and download ESG / BRSR / audit reports — every value resolved from approved source records. Versioned; historical reports never overwritten.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-subtle flex items-center gap-2 rounded-full px-3 py-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">All Types</option>
              {REPORT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="glass-subtle flex items-center gap-2 rounded-full px-3 py-2 text-xs">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              placeholder="Year"
              className="w-16 bg-transparent font-semibold text-slate-700 outline-none tabular-nums"
            />
          </div>
          <button
            onClick={() => setGenerateOpen(true)}
            className="btn-glass-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate Report
          </button>
        </div>
      </div>

      {/* SUMMARY TILES */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Total Reports" value={reports.length} icon={FileBarChart} tone="blue" />
        <SummaryTile label="Completed" value={reports.filter(r => r.status === 'COMPLETED').length} icon={FileCheck2} tone="emerald" />
        <SummaryTile label="BRSR Reports" value={reports.filter(r => r.reportType === 'BRSR').length} icon={Layers} tone="violet" />
        <SummaryTile label="Module Reports" value={reports.filter(r => r.reportType !== 'BRSR').length} icon={Database} tone="amber" />
      </div>

      {/* REPORTS TABLE */}
      <div className="glass glass-shimmer rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Report History</h3>
            <span className="status-pill status-submitted">{reports.length} records</span>
          </div>
          <button onClick={load} className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white/30 py-12 text-center">
            <FileBarChart className="h-10 w-10 text-slate-300" />
            <div className="text-sm font-bold text-slate-600">No reports yet</div>
            <div className="max-w-xs text-xs text-slate-500">Click "Generate Report" above to compile your first ESG summary, BRSR pack, or module-specific report.</div>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-elegant">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Framework</th>
                  <th className="px-2 py-2 font-semibold">Year</th>
                  <th className="px-2 py-2 font-semibold">Period</th>
                  <th className="px-2 py-2 font-semibold">Scope</th>
                  <th className="px-2 py-2 font-semibold">Generated By</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Ver</th>
                  <th className="px-2 py-2 font-semibold">File</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    onClick={() => handleOpenDetail(r)}
                    className="cursor-pointer border-b border-slate-100/60 transition hover:bg-white/50"
                  >
                    <td className="px-2 py-2.5">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{r.reportType}</span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-500">{r.frameworkId ? 'BRSR v3' : '—'}</td>
                    <td className="px-2 py-2.5 text-slate-600 tabular-nums">{r.reportingYear ? `FY${r.reportingYear}` : '—'}</td>
                    <td className="px-2 py-2.5 text-slate-600">{r.periodLabel ?? '—'}</td>
                    <td className="px-2 py-2.5 text-slate-600">{r.scopeName ?? r.scopeType ?? 'Group'}</td>
                    <td className="px-2 py-2.5 text-slate-600">{r.generatedBy}</td>
                    <td className="px-2 py-2.5">
                      <span className={`status-pill ${statusPill(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-600 tabular-nums">v{r.version}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-col">
                        <span className="truncate text-[10px] text-slate-500" style={{ maxWidth: 140 }}>{r.fileName}</span>
                        <span className="text-[9px] uppercase tracking-wide text-slate-400">{r.fileType}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenDetail(r) }}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100"
                          title="View detail"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <a
                          href={`/api/pu/reports/${r.id}/download?inline=true`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          title="View Official PDF in browser"
                        >
                          <FileText className="h-3 w-3" /> PDF
                        </a>
                        <a
                          href={`/api/pu/reports/${r.id}/download`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-100"
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GENERATE DIALOG */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="glass-strong sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Sparkles className="h-4 w-4 text-blue-600" /> Generate Report
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Compile a versioned report from approved source records. Historical reports are never overwritten.
            </DialogDescription>
          </DialogHeader>
          <GenerateForm onDone={onGenerated} />
        </DialogContent>
      </Dialog>

      {/* DETAIL SHEET */}
      <Sheet open={!!selected || detailLoading} onOpenChange={(o) => { if (!o) { setSelected(null); setDetailLoading(false) } }}>
        <SheetContent side="right" className="glass-strong w-full overflow-y-auto scroll-elegant sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <FileText className="h-4 w-4 text-blue-600" /> Report Detail
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Structured content compiled server-side — no hardcoded values.
            </SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report content…
            </div>
          ) : selected ? (
            <ReportDetailBody report={selected} />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ROLE NOTICE */}
      {user && (
        <div className="glass-subtle flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-slate-500">
          <AlertOctagon className="h-3.5 w-3.5 text-amber-500" />
          <span>Report generation requires the <code>report.generate</code> permission. Roles without it have read access only.</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Generate form
// ============================================================
function GenerateForm({ onDone }: { onDone: () => void }) {
  const [reportType, setReportType] = useState('ESG_SUMMARY')
  const [reportingYear, setReportingYear] = useState(2026)
  const [periodLabel, setPeriodLabel] = useState('')
  const [scopeType, setScopeType] = useState('GROUP')
  const [scopeId, setScopeId] = useState('')
  const [scopeName, setScopeName] = useState('MEIL Group (All)')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const isBrsr = reportType === 'BRSR'
      const url = isBrsr ? '/api/pu/brsr/generate' : '/api/pu/reports/generate'
      const body: Record<string, unknown> = {
        reportingYear,
        scopeType,
        scopeName,
      }
      if (isBrsr) {
        // BRSR needs frameworkId — fetch first framework if not set
        const fwResp = await fetch('/api/pu/brsr/frameworks').then(r => r.json())
        const fws = (fwResp.frameworks ?? []) as Array<{ id: string }>
        if (fws.length === 0) {
          toast.error('No BRSR framework available', { description: 'Seed a BRSR framework first.' })
          setSubmitting(false)
          return
        }
        body.frameworkId = fws[0].id
        body.scopeId = scopeId || null
      } else {
        if (scopeId) body.scopeId = scopeId
        if (periodLabel) body.periodLabel = periodLabel
        body.reportType = reportType
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Permission required', { description: data?.error ?? 'Forbidden' })
        } else {
          toast.error(data?.error ?? 'Generate failed', { description: data?.detail })
        }
      } else {
        toast.success(`${reportType} report generated`, {
          description: `v${data.report?.version} · ${data.report?.fileName ?? ''}`,
        })
        onDone()
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 px-1">
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Report Type</label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
        >
          {REPORT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label} — {t.description}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reporting Year</label>
          <input
            type="number"
            value={reportingYear}
            onChange={(e) => setReportingYear(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm tabular-nums text-slate-700 outline-none focus:border-blue-300"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Period Label (optional)</label>
          <input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="e.g. Apr-2026"
            className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scope Type</label>
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
          >
            <option value="GROUP">GROUP</option>
            <option value="SUBSIDIARY">SUBSIDIARY</option>
            <option value="BU">BUSINESS_UNIT</option>
            <option value="PROJECT">PROJECT</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scope ID (optional)</label>
          <input
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            placeholder="auto if group"
            className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scope Name</label>
        <input
          value={scopeName}
          onChange={(e) => setScopeName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="btn-glass-primary flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Generate
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Report detail body
// ============================================================
function ReportDetailBody({ report }: { report: ReportDetail }) {
  const c = report.content
  return (
    <div className="space-y-3 px-4 pb-6">
      {/* Meta */}
      <div className="rounded-2xl border border-white/60 bg-white/40 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-700">{report.reportType}</span>
          <span className="text-slate-500">v{report.version}</span>
          <span>·</span>
          <span className="text-slate-600">{report.scopeName ?? report.scopeType ?? 'Group'}</span>
          <span>·</span>
          <span className="text-slate-600 tabular-nums">{report.reportingYear ? `FY${report.reportingYear}` : '—'}</span>
          <span>·</span>
          <span className="text-slate-600 tabular-nums">{new Date(report.createdAt).toLocaleString()}</span>
          <span className={`status-pill ${statusPill(report.status)}`}>{report.status}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          <Hash className="h-3 w-3" /> <code>{report.fileName}</code>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
          <Building2 className="h-3 w-3" /> Generated by <strong className="text-slate-700">{report.generatedBy}</strong>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <a
            href={`/api/pu/reports/${report.id}/download`}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <Download className="h-3 w-3" /> Download {report.fileType}
          </a>
          <a
            href={`/api/pu/reports/${report.id}/download?inline=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            <FileText className="h-3 w-3" /> View Official PDF
          </a>
        </div>
      </div>

      {/* Content */}
      {c && typeof c === 'object' ? (
        <ReportContentRenderer content={c} />
      ) : (
        <div className="rounded-xl bg-white/40 p-3 text-xs text-slate-500">{String(c ?? 'No content')}</div>
      )}
    </div>
  )
}

function ReportContentRenderer({ content }: { content: unknown }) {
  const obj = content as Record<string, any>
  // BRSR-style content
  if (obj.sections && Array.isArray(obj.sections)) {
    return (
      <div className="space-y-2">
        {obj.meta && <MetaBlock meta={obj.meta} />}
        {obj.readiness && (
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3 text-xs">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              <FileCheck2 className="h-3.5 w-3.5" /> Readiness
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-800 tabular-nums">
              {obj.readiness.overallPct}%
              <span className="ml-2 text-xs font-normal text-emerald-600">({obj.readiness.ready}/{obj.readiness.total} ready)</span>
            </div>
          </div>
        )}
        {(obj.sections as any[]).map((s: any, i: number) => (
          <div key={i} className="rounded-xl bg-white/50 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Section {s.sectionCode} · {s.sectionName}
            </div>
            <div className="space-y-1">
              {(s.questions ?? []).map((q: any, j: number) => (
                <div key={j} className="rounded-lg bg-white/60 px-2.5 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">{q.questionCode}</code>
                      <span className="text-slate-700">{q.questionText}</span>
                    </div>
                    <span className={`status-pill ${statusPill(q.status)}`}>{q.status}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-700 tabular-nums">{String(q.resolvedValue ?? '—')}</span>
                    {q.resolvedUnit && <span>{q.resolvedUnit}</span>}
                    {q.mappingSource && <code className="rounded bg-slate-100 px-1 py-0.5">{q.mappingSource}</code>}
                    {q.sourceRecordIds?.length > 0 && <span>· {q.sourceRecordIds.length} sources</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  // Module-style content (totals + byProject)
  return (
    <div className="space-y-2">
      {obj.meta && <MetaBlock meta={obj.meta} />}
      {obj.totals && <TotalsBlock totals={obj.totals} />}
      {obj.modules && (
        <div className="rounded-xl bg-white/40 p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">Module Breakdown</div>
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(obj.modules as Record<string, any>).map(([mod, m]) => (
              <div key={mod} className="rounded-lg bg-white/60 p-2 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">{mod}</div>
                {m?.totals ? (
                  <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
                    {Object.entries(m.totals as Record<string, any>).slice(0, 6).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-slate-500">{k}</span>
                        <span className="tabular-nums font-semibold text-slate-700">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-[10px] text-slate-400">No totals</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(obj.logs) && (
        <div className="rounded-xl bg-white/40 p-3 text-xs">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">{obj.logs.length} Audit Log Entries</div>
          <div className="max-h-40 overflow-y-auto scroll-elegant space-y-1">
            {obj.logs.slice(0, 30).map((l: any, i: number) => (
              <div key={i} className="rounded bg-white/50 px-2 py-1 text-[10px] text-slate-600">
                <span className="font-semibold text-slate-700">{l.action}</span>
                <span className="ml-2 text-slate-500">{l.actorName}</span>
                <span className="ml-2 text-slate-400">{l.entityType}:{String(l.entityId).slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetaBlock({ meta }: { meta: Record<string, any> }) {
  if (!meta) return null
  return (
    <div className="rounded-xl bg-blue-50/40 px-3 py-2 text-[11px] text-slate-600">
      <div className="flex items-center gap-2">
        <GitBranch className="h-3 w-3 text-blue-500" />
        <span className="font-semibold text-slate-700">Generated</span>
        <span className="tabular-nums">{meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : '—'}</span>
      </div>
    </div>
  )
}

function TotalsBlock({ totals }: { totals: Record<string, any> }) {
  const entries = Object.entries(totals)
  if (entries.length === 0) return null
  return (
    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        <ListChecks className="h-3.5 w-3.5" /> Totals
      </div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/60 px-2 py-1.5">
            <div className="text-[10px] text-slate-500">{k}</div>
            <div className="text-sm font-bold tabular-nums text-slate-800">{formatVal(v)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Building blocks + helpers
// ============================================================
function SummaryTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass glass-shimmer rounded-2xl p-4"
    >
      <div className={`kpi-tile ${toneMap[tone] ?? toneMap.blue}`}><Icon className="h-5 w-5" /></div>
      <div className="mt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="tabular-nums text-2xl font-bold text-slate-800">{value}</div>
      </div>
    </motion.div>
  )
}

function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200/60" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="glass h-28 animate-pulse rounded-2xl" />)}
      </div>
      <div className="glass h-96 animate-pulse rounded-2xl" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load reports</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

const REPORT_TYPES = [
  { key: 'BRSR_ANNEXURE_I', label: 'BRSR Annexure-I (Official PDF)', description: 'Official 14-page SEBI BRSR Annexure-I statutory disclosure' },
  { key: 'BRSR', label: 'BRSR Framework', description: 'Full BRSR v3 framework report' },
  { key: 'ESG_SUMMARY', label: 'ESG Summary', description: 'All-modules ESG pack' },
  { key: 'EMISSIONS', label: 'Emissions', description: 'GHG Scope 1/2/3 by project' },
  { key: 'ENERGY', label: 'Energy', description: 'Energy GJ by source' },
  { key: 'WATER', label: 'Water', description: 'Withdrawal / recycle balance' },
  { key: 'WASTE', label: 'Waste', description: 'Generated vs recovered' },
  { key: 'WORKFORCE', label: 'Workforce', description: 'Headcount + training hours' },
  { key: 'SAFETY', label: 'Safety', description: 'LTIFR + incidents' },
  { key: 'EVIDENCE_PACKAGE', label: 'Evidence Package', description: 'Evidence bundle (uses audit logs)' },
  { key: 'AUDIT_PACKAGE', label: 'Audit Package', description: 'Full audit log CSV' },
]

function statusPill(status: string): string {
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

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
