// Replacement RecordGrid for the env-user submissions detail sheet.
export const RECORD_GRID_CODE = String.raw`function RecordGrid({ records, module: mod, corrections = [] }: { records: SourceRecordRow[]; module: string; corrections?: Correction[] }) {
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
                const evNames: string[] = Array.isArray(it.evidenceFiles) ? it.evidenceFiles : []
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
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {evNames.map((f, fi) => (
                          <span key={fi} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-800">
                            <FolderOpen className="h-2.5 w-2.5" /> {f}
                          </span>
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
`
