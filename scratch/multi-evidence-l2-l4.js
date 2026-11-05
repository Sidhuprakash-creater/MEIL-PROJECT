// Converts L2/L4 single-evidence state to the multi-evidence pattern (like L3).
const { readFileSync, writeFileSync } = require('node:fs')

for (const p of ['src/components/shared/data-entry/forms/level2-water.tsx', 'src/components/shared/data-entry/forms/level4-waste.tsx']) {
  let t = readFileSync(p, 'utf8')
  const n0 = t

  // 1. staged-item interface gains the multi fields
  t = t.replace(/  evidenceId: string\n(\s*evidenceFileName\?: string)/, '  evidenceId: string\n  evidenceIds?: string[]\n  evidenceFiles?: string[]\n$1')

  // 2. state
  t = t.replace("const [evidenceId, setEvidenceId] = useState('')", 'const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])')

  // 3. loaders / resets
  t = t.replace('      setEvidenceId(existing.evidenceId)', '      setSelectedEvidenceIds(existing.evidenceIds?.length ? existing.evidenceIds : existing.evidenceId ? [existing.evidenceId] : [])')
  t = t.replace(/      setEvidenceId\(item\.evidenceId\)/, '      setSelectedEvidenceIds(item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : [])')
  t = t.split("      setEvidenceId('')").join('      setSelectedEvidenceIds([])')
  t = t.split("    setEvidenceId('')").join('    setSelectedEvidenceIds([])')

  // 4. attached-file lookup
  t = t.replace(/const attachedEv = evidence\.find\(\(e(cess|v)?\) => e(cess)?\.id === evidenceId\)/, 'const attachedEv = evidence.find((ev) => selectedEvidenceIds.includes(ev.id))')

  // 5. item payload: single id + multi ids
  t = t.replace(/      evidenceId,\n(\s*evidenceFileName: attachedEv\?\.fileName,)/, "      evidenceId: selectedEvidenceIds[0] || '',\n      evidenceIds: selectedEvidenceIds,\n      evidenceFiles: selectedEvidenceIds\n        .map((id) => evidence.find((ev) => ev.id === id)?.fileName)\n        .filter(Boolean) as string[],\n$1")

  // 6. consolidated sync payload
  t = t.replace("      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || evidenceId,", "      evidenceId: itemsToSave.find((i) => i.evidenceId)?.evidenceId || selectedEvidenceIds[0] || '',\n      evidenceIds: Array.from(new Set(itemsToSave.flatMap((i) => (i.evidenceIds?.length ? i.evidenceIds : i.evidenceId ? [i.evidenceId] : [])))),")

  // 7. effect dep arrays + remaining bare references in save closures
  t = t.replace(/(\r?\n\s*)evidenceId,(\r?\n\s*formStateRef,)/, '$1selectedEvidenceIds,$2')
  t = t.replace(/(\r?\n\s*)evidenceId,(\r?\n\s*factor: f,)/, "$1evidenceId: selectedEvidenceIds[0] || '',$2")

  // 8. attach section props -> multi
  t = t.replace(/              selectedEvidenceId=\{evidenceId \|\| null\}\r?\n\s*onSelectEvidence=\{\(id\) => setEvidenceId\(id \|\| ''\)\}/, '              selectedEvidenceIds={selectedEvidenceIds}\n              onSelectEvidenceIds={setSelectedEvidenceIds}')

  writeFileSync(p, t)
  const leftovers = (t.match(/\bevidenceId\b/g) || []).length - (t.match(/\bevidenceIds\b/g) || []).length
  console.log(p.split('/').pop(), '| setEvidenceId remains:', t.includes('setEvidenceId('), '| bare evidenceId refs:', (t.match(/[^s]evidenceId(?!s|FileName|: | =)/g) || []).length, '| changed:', t !== n0)
}
