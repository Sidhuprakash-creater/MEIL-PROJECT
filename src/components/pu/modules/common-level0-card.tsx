'use client'
import React, { useState } from 'react'
import {
  Building2, Calendar, FileText, Link2, Info, ChevronDown, ChevronUp,
  ShieldCheck, Clock, CheckCircle2, AlertTriangle, Layers, User, Sparkles
} from 'lucide-react'
import type { CommonReportingFields } from '@/lib/pu/contributor-store'

interface CommonLevel0CardProps {
  fields: CommonReportingFields
  onChange?: (updated: Partial<CommonReportingFields>) => void
  readOnly?: boolean
  accentColor?: 'teal' | 'amber' | 'blue' | 'rose' | 'purple'
}

export function CommonLevel0Card({
  fields,
  onChange,
  readOnly = false,
  accentColor = 'teal'
}: CommonLevel0CardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  const accentStyles = {
    teal: {
      badge: 'border-teal-200 bg-teal-50/80 text-teal-700',
      iconBg: 'bg-teal-500/15 text-teal-600',
      border: 'border-teal-100/60',
      tag: 'bg-teal-100 text-teal-800'
    },
    amber: {
      badge: 'border-amber-200 bg-amber-50/80 text-amber-700',
      iconBg: 'bg-amber-500/15 text-amber-600',
      border: 'border-amber-100/60',
      tag: 'bg-amber-100 text-amber-800'
    },
    blue: {
      badge: 'border-blue-200 bg-blue-50/80 text-blue-700',
      iconBg: 'bg-blue-500/15 text-blue-600',
      border: 'border-blue-100/60',
      tag: 'bg-blue-100 text-blue-800'
    },
    rose: {
      badge: 'border-rose-200 bg-rose-50/80 text-rose-700',
      iconBg: 'bg-rose-500/15 text-rose-600',
      border: 'border-rose-100/60',
      tag: 'bg-rose-100 text-rose-800'
    },
    purple: {
      badge: 'border-purple-200 bg-purple-50/80 text-purple-700',
      iconBg: 'bg-purple-500/15 text-purple-600',
      border: 'border-purple-100/60',
      tag: 'bg-purple-100 text-purple-800'
    }
  }[accentColor]

  return (
    <div className="relative overflow-hidden glass-form-card !p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentStyles.iconBg}`}>
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">
                Level 0 — Common Reporting Metadata
              </h3>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${accentStyles.badge}`}>
                BRSR Universal Standard
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Assigned entity context, reporting boundary, traceability and workflow audit fields
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="ios-btn-ghost"
        >
          {isExpanded ? (
            <>
              <span>Collapse 24 Fields</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span>View 24 Fields</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Section 1: Entity & Organizational Context (Prefilled / Read-only) */}
          <div className="glass-subtle rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
              <span>Assigned Entity & Project Scope (Prefilled · Read-only)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">1. Entity / Company Name</span>
                <span className="font-semibold text-slate-800 truncate block">{fields.entityName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">2. Entity ID</span>
                <span className="font-semibold text-slate-800">{fields.entityId}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">3. Subsidiary / Business Unit</span>
                <span className="font-semibold text-slate-800 truncate block">{fields.subsidiaryOrBu}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">4. Project / Site ID</span>
                <span className="font-semibold text-blue-700">{fields.projectId}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Reporting Period & Timeline */}
          <div className="glass-subtle rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-teal-500" />
              <span>Reporting Period & Boundaries</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">5. Reporting Financial Year</span>
                <span className="font-semibold text-slate-800">{fields.reportingFy}</span>
              </div>
              <div>
                <label className="text-slate-500 block text-[11px] mb-1 font-medium">6. Reporting Period</label>
                <select
                  disabled={readOnly}
                  value={fields.reportingPeriod}
                  onChange={(e) => onChange?.({ reportingPeriod: e.target.value as any })}
                  className="ios-field !px-2.5 !py-1.5 !text-xs"
                >
                  <option value="Month">Month</option>
                  <option value="Quarter">Quarter</option>
                  <option value="Financial Year">Financial Year</option>
                </select>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">7. Start Date</span>
                <span className="font-medium text-slate-700">{fields.reportingStartDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">8. End Date</span>
                <span className="font-medium text-slate-700">{fields.reportingEndDate}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Data Record, Availability & Traceability */}
          <div className="glass-subtle rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <FileText className="h-3.5 w-3.5 text-purple-500" />
              <span>Data Record Parameters & Source Traceability</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">9. Data Module</span>
                <span className="font-semibold text-slate-800">{fields.dataModule}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">10. Data Category</span>
                <span className="font-semibold text-slate-800">{fields.dataCategory}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">11. Record / Activity Name</span>
                <span className="font-semibold text-slate-800 truncate block">{fields.recordName}</span>
              </div>
              <div>
                <label className="text-slate-500 block text-[11px] mb-1 font-medium">14. Data Availability</label>
                <select
                  disabled={readOnly}
                  value={fields.dataAvailability}
                  onChange={(e) => onChange?.({ dataAvailability: e.target.value as any })}
                  className="ios-field !px-2.5 !py-1.5 !text-xs"
                >
                  <option value="Reported">Reported</option>
                  <option value="Zero">Zero</option>
                  <option value="Estimated">Estimated</option>
                  <option value="Not Available">Not Available</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>

              <div>
                <label className="text-slate-500 block text-[11px] mb-1 font-medium">15. Data Source</label>
                <select
                  disabled={readOnly}
                  value={fields.dataSource}
                  onChange={(e) => onChange?.({ dataSource: e.target.value as any })}
                  className="ios-field !px-2.5 !py-1.5 !text-xs"
                >
                  <option value="Register">Register</option>
                  <option value="System">System (SAP / ERP)</option>
                  <option value="Report">Report</option>
                  <option value="Survey">Survey</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-slate-500 block text-[11px] mb-1 font-medium">16. Source Reference</label>
                <input
                  disabled={readOnly}
                  type="text"
                  value={fields.sourceReference}
                  onChange={(e) => onChange?.({ sourceReference: e.target.value })}
                  placeholder="Doc ID / Ledger ref"
                  className="ios-field !px-2.5 !py-1.5 !text-xs"
                />
              </div>
              <div>
                <label className="text-slate-500 block text-[11px] mb-1 font-medium">17. Calculation Method</label>
                <select
                  disabled={readOnly}
                  value={fields.calculationMethod}
                  onChange={(e) => onChange?.({ calculationMethod: e.target.value as any })}
                  className="ios-field !px-2.5 !py-1.5 !text-xs"
                >
                  <option value="Directly measured">Directly measured</option>
                  <option value="Calculated">Calculated</option>
                  <option value="Estimated">Estimated</option>
                </select>
              </div>
              <div>
                <label className="text-slate-500 block text-[11px] mb-1 font-medium">18. Supporting Evidence</label>
                <div className="flex items-center gap-1.5">
                  <input
                    disabled={readOnly}
                    type="text"
                    value={fields.supportingEvidence}
                    onChange={(e) => onChange?.({ supportingEvidence: e.target.value })}
                    placeholder="Link or doc ID"
                    className="ios-field !px-2.5 !py-1.5 !text-xs"
                  />
                  <Link2 className="h-4 w-4 text-blue-500 shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Audit & Submission Metadata */}
          <div className="glass-subtle rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Audit History & Review State</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">20. Prepared By</span>
                <span className="font-semibold text-slate-800 truncate block">{fields.preparedBy}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">21. Created At</span>
                <span className="font-medium text-slate-600">{fields.createdAt}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">22. Last Updated</span>
                <span className="font-medium text-slate-600">{fields.lastUpdated}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">23. Submission Status</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  fields.submissionStatus === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                  fields.submissionStatus === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                  fields.submissionStatus === 'Under Review' ? 'bg-purple-100 text-purple-800' :
                  fields.submissionStatus === 'Returned' ? 'bg-rose-100 text-rose-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {fields.submissionStatus}
                </span>
              </div>
            </div>

            {fields.reviewerComments && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-900">
                <span className="font-bold">24. Reviewer Comments: </span>
                {fields.reviewerComments}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
