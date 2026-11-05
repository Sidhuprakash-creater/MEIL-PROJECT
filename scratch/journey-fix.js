// Widens the existing-records fetch to all levels and adds client-side level filtering,
// so the Emission Sequence Journey sees every level's saved records.
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/data-entry/index.tsx'
let t = readFileSync(p, 'utf8')

// 1. fetch without the level filter
const before1 = t
t = t.replace(
  "`${apiBase}/data-entry?projectId=${encodeURIComponent(selectedProjectId)}&periodId=${encodeURIComponent(selectedPeriodId)}&level=${activeSub.level}`",
  "`${apiBase}/data-entry?projectId=${encodeURIComponent(selectedProjectId)}&periodId=${encodeURIComponent(selectedPeriodId)}`",
)
console.log('fetch widened:', t !== before1)

// 2. activeLevel filter helper + split state: existingRecords (all) drives the journey;
//    the Existing Records list shows the active level's slice.
t = t.replace(
  "  const [existingRecords, setExistingRecords] = useState<any[]>([])",
  `  const [existingRecords, setExistingRecords] = useState<any[]>([])
  /* Records of the ACTIVE level only — the list under the form. The journey
     receives the full set so prior levels keep their cards when switching. */
  const activeLevelRecords = existingRecords.filter((r: any) => {
    if (activeLevelKey === 'level5') return r.level === 5 || r.level === 7
    if (activeLevelKey === 'level6') return r.level === 6 || r.level === 9
    if (activeLevelKey === 'level7') return r.level === 5 || r.level === 7
    if (activeLevelKey === 'level9') return r.level === 6 || r.level === 9
    return r.level === Number(String(activeLevelKey).replace('level', '')) || r.levelKey === activeLevelKey
  })`,
)

// 3. Existing Records list + corrections lookups use the active slice
t = t.replace('{existingRecords.length > 0 ? (', '{activeLevelRecords.length > 0 ? (')
t = t.replace('{existingRecords.map((r: any) => {', '{activeLevelRecords.map((r: any) => {')
t = t.replace(
  'No records recorded yet for {activeSub.brsrTitle} in {selectedPeriod?.label}.',
  'No records recorded yet for {activeSub.brsrTitle} in {selectedPeriod?.label}.',
)

// 4. journey panel gets the FULL set
t = t.replace('          existingRecords={existingRecords}\n', '          existingRecords={existingRecords}\n')

writeFileSync(p, t)
console.log('index.tsx journey wiring done')
