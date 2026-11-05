#!/usr/bin/env node
/**
 * Phase 0 codemod — mechanical split of src/components/pu/modules/data-entry.tsx
 * into src/components/shared/data-entry/*, plus:
 *   1. DataEntryModule becomes props-driven (no useApp import; apiBase prop).
 *   2. All `fetch('/api/pu/...')` calls become `fetch(`${apiBase}/...`)`.
 *   3. A console-agnostic ApiBaseContext is provided by index.tsx and consumed
 *      by the evidence uploaders and level forms via useApiBase().
 *
 * The split is symbol-based: every top-level declaration (with its preceding
 * comment banner) is assigned to a target file; cross-file imports are computed
 * by identifier scan. No behavioral code is changed beyond the prop wiring.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src/components/pu/modules/data-entry.tsx')
const OUTDIR = join(ROOT, 'src/components/shared/data-entry')

const raw = readFileSync(SRC, 'utf8')
const EOL = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(/\r?\n/)

/* ---------------- 1. Parse the original import block ---------------- */
const extImports = [] // { module, names: [{name, typeOnly}] }
for (let k = 0; k < lines.length; k++) {
  if (!/^import\s/.test(lines[k])) continue
  let stmt = lines[k]
  while (!/from\s+'[^']+'/.test(stmt) && k + 1 < lines.length) {
    k += 1
    stmt += '\n' + lines[k]
  }
  const mod = (stmt.match(/from\s+'([^']+)'/) || [])[1]
  if (!mod) continue
  const names = []
  const brace = stmt.match(/\{([\s\S]*?)\}/)
  if (brace) {
    for (const part of brace[1].split(',')) {
      const n = part.trim()
      if (!n) continue
      const tm = n.match(/^type\s+(\w+)$/)
      if (tm) names.push({ name: tm[1], typeOnly: true })
      else if (/^\w+$/.test(n)) names.push({ name: n, typeOnly: false })
    }
  } else {
    const d = stmt.match(/^import\s+(\w+)\s+from/)
    if (d) names.push({ name: d[1], typeOnly: false })
  }
  extImports.push({ module: mod, names })
  if (mod === 'sonner') break
}

/* Module doc comment (kept as the header of index.tsx) */
const docMatch = raw.match(/\/\*\*[\s\S]*?\*\//)
const docComment = docMatch ? docMatch[0] : ''

/* ---------------- 2. Group top-level declarations ---------------- */
const declRe = /^(?:export\s+)?(?:async\s+)?(?:function\s|interface\s|type\s|const\s)/
const nameRe = /^(?:export\s+)?(?:async\s+)?(?:function|interface|type|const)\s+([A-Za-z_0-9]+)/

let start = 0
for (let k = 0; k < lines.length; k++) {
  if (/^import .*'sonner'/.test(lines[k])) { start = k + 1; break }
}

const groups = []
for (let k = start; k < lines.length; k++) {
  if (declRe.test(lines[k])) {
    groups.push({ declLine: k, name: (lines[k].match(nameRe) || [])[1] })
  }
}

/* Each group spans [declLine, nextDeclLine); the boxed banner comment that
   precedes a declaration sits at the END of the previous group's span, so it
   is moved to the head of the following group afterwards. */
for (let g = 0; g < groups.length; g++) {
  const from = groups[g].declLine
  const to = g + 1 < groups.length ? groups[g + 1].declLine : lines.length
  groups[g].text = lines.slice(from, to).join('\n')
}

/* Pre-first-decl lines (blank + section comment) attach to the first group */
const prelude = lines.slice(start, groups[0].declLine).join('\n').trim()
if (prelude) groups[0].text = prelude + '\n\n' + groups[0].text

/* Move trailing boxed banner comments to the next group's head */
const BOXED = /\n\/\* =+\n(?:[ \t]+[^\n]*\n)*[ \t]+=+ \*\/\n?$/
for (let g = 0; g < groups.length - 1; g++) {
  const m = groups[g].text.match(BOXED)
  if (m) {
    const banner = m[0].replace(/^\n/, '').replace(/\n$/, '')
    groups[g].text = groups[g].text.slice(0, m.index + 1).replace(/\s+$/, '') + '\n'
    groups[g + 1].text = banner + '\n\n' + groups[g + 1].text
  }
}
for (const g of groups) {
  g.text = g.text.replace(/\s+$/, '') + '\n'
}

/* ---------------- 3. Symbol registry ---------------- */
const HOMES = {
  // core.tsx
  LevelKey: 'core', LevelConfig: 'core', SUB_MODULES: 'core', normalizeSubModule: 'core',
  Project: 'core', Period: 'core', EvidenceItem: 'core', ValidationIssue: 'core', CalcPayload: 'core',
  SavedRecord: 'core', READ_ONLY_ROLES: 'core', STEPS: 'core',
  // index.tsx
  DataEntryModule: 'index',
  // primitives.tsx
  Stepper: 'primitives', CalculationPreview: 'primitives', Field: 'primitives',
  ValidationResults: 'primitives', LevelFormProps: 'primitives', inputClass: 'primitives',
  FormGrid: 'primitives', FormField: 'primitives', FormSaveActions: 'primitives',
  // engine-evidence-panel.tsx
  FlippablePanelProps: 'engine-evidence-panel', FlippableEngineEvidencePanel: 'engine-evidence-panel',
  // evidence.tsx
  EvidenceUploadSectionProps: 'evidence', EvidenceUploadSection: 'evidence',
  EvidenceReviewBackfaceProps: 'evidence', EvidenceReviewBackface: 'evidence',
  FullscreenEvidenceModal: 'evidence', EvidencePicker: 'evidence',
  // evidence-attach.tsx
  FormEvidenceAttachSectionProps: 'evidence-attach', FormEvidenceAttachSection: 'evidence-attach',
  // forms/
  L1_ENERGY_SOURCES: 'level1', L1_ACTIVITIES: 'level1', L1_UNITS: 'level1', L1_DOCUMENTS: 'level1',
  StagedEnergyItem: 'level1', SOURCE_PRESETS: 'level1', calculateItemEmissions: 'level1', Level1EnergyForm: 'level1',
  L2_ACTIVITIES: 'level2', L2_SOURCES: 'level2', L2_TREATMENTS: 'level2', L2_DESTINATIONS: 'level2',
  StagedWaterItem: 'level2', WATER_SOURCE_PRESETS: 'level2', Level2WaterForm: 'level2',
  StagedGhgItem: 'level3', L3_SOURCES: 'level3', GhgPresetConfig: 'level3',
  GHG_SOURCE_PRESETS: 'level3', SCOPE_3_CATEGORIES: 'level3', Level3GhgForm: 'level3',
  StagedWasteItem: 'level4', L4_CATEGORIES: 'level4', L4_METHODS: 'level4',
  WASTE_CATEGORY_PRESETS: 'level4', calculateWasteCircularity: 'level4', Level4WasteForm: 'level4',
  Level5SafetyForm: 'level5',
  Level6TrainingForm: 'level6',
  L7_PERMIT_TYPES: 'level7', L7_PRESETS: 'level7', StagedPermitItem: 'level7', Level7ComplianceForm: 'level7',
  Level8IncidentsForm: 'level8',
  L9_CATEGORIES: 'level9', L9_PRESETS: 'level9', StagedInitiativeItem: 'level9', Level9InitiativesForm: 'level9',
  // states.tsx
  describeLevelRecord: 'states', DataEntrySkeleton: 'states', ErrorState: 'states', EmptyState: 'states',
}

const TYPE_ONLY = new Set([
  'LevelKey', 'LevelConfig', 'Project', 'Period', 'EvidenceItem', 'ValidationIssue', 'CalcPayload',
  'SavedRecord', 'LevelFormProps', 'FlippablePanelProps', 'EvidenceUploadSectionProps',
  'EvidenceReviewBackfaceProps', 'FormEvidenceAttachSectionProps', 'StagedEnergyItem', 'StagedWaterItem',
  'StagedGhgItem', 'GhgPresetConfig', 'StagedWasteItem', 'StagedPermitItem', 'StagedInitiativeItem',
  'ItemDetailData', 'LucideIcon',
])

const FILE_BY_KEY = {
  core: 'core.tsx', index: 'index.tsx', primitives: 'primitives.tsx',
  'engine-evidence-panel': 'engine-evidence-panel.tsx', evidence: 'evidence.tsx',
  'evidence-attach': 'evidence-attach.tsx',
  level1: 'forms/level1-energy.tsx', level2: 'forms/level2-water.tsx', level3: 'forms/level3-ghg.tsx',
  level4: 'forms/level4-waste.tsx', level5: 'forms/level5-safety.tsx', level6: 'forms/level6-training.tsx',
  level7: 'forms/level7-compliance.tsx', level8: 'forms/level8-incidents.tsx', level9: 'forms/level9-initiatives.tsx',
  states: 'states.tsx',
}

/* ---------------- 4. Buckets + transforms ---------------- */
const buckets = {}
for (const g of groups) {
  if (!g.name || !(g.name in HOMES)) {
    console.error(`UNKNOWN top-level symbol at line ${g.declLine + 1}: ${g.name}`)
    process.exit(1)
  }
  ;(buckets[HOMES[g.name]] ||= []).push(g)
}

/* 4a. core.tsx — append the console-agnostic API-base context */
buckets.core.push({
  name: '__apibase__',
  text: [
    '/* ---------------- Console-agnostic API base ----------------',
    " * index.tsx provides the console surface ('/api/pu' or '/api/so') via",
    ' * its `apiBase` prop; nested components consume it with useApiBase().',
    ' * ---------------------------------------------------------------- */',
    "export const ApiBaseContext = createContext<string>('/api/pu')",
    '',
    'export function useApiBase(): string {',
    '  return useContext(ApiBaseContext)',
    '}',
    '',
  ].join('\n'),
})

/* 4b. index.tsx — props-driven DataEntryModule */
{
  const g = buckets.index.find((x) => x.name === 'DataEntryModule')
  let t = g.text
  const oldHead = [
    'export function DataEntryModule({ subModule: subModuleProp }: { subModule: string }) {',
    "  const { user, setDataEntrySubModule, selectedProjectId: appProjectId } = useApp()",
    "  const roleKey = user?.roles?.[0]?.key ?? ''",
  ].join('\n')
  if (!t.includes(oldHead)) { console.error('index head transform failed'); process.exit(1) }
  const newHead = [
    'export interface DataEntryModuleProps {',
    '  subModule?: string',
    "  /** Console API surface — '/api/pu' (Project User portal) or '/api/so' (site-ops console). */",
    "  apiBase?: string",
    '  roleKey?: string',
    '  userScopes?: { scopeType: string; scopeId: string }[]',
    '  appProjectId?: string | null',
    '  onSubModuleChange?: (key: LevelKey) => void',
    '}',
    '',
    'export function DataEntryModule({',
    '  subModule: subModuleProp,',
    "  apiBase = '/api/pu',",
    '  roleKey: roleKeyProp,',
    '  userScopes,',
    '  appProjectId,',
    '  onSubModuleChange,',
    '}: DataEntryModuleProps) {',
    "  const roleKey = roleKeyProp ?? ''",
  ].join('\n')
  t = t.replace(oldHead, newHead)
  t = t.replace(/user\?\.scopes/g, 'userScopes')
  t = t.replace(/setDataEntrySubModule\(/g, 'onSubModuleChange?.(')
  t = t.replace(/fetch\('\/api\/pu\/([^']*)'/g, 'fetch(`${apiBase}/$1`')
  t = t.replace('<CsvImportDialog', '<CsvImportDialog\n          apiBase={apiBase}')
  /* Wrap the returned tree in the ApiBaseContext provider */
  const openMarker = '  return (\n    <div className="space-y-5">'
  if (!t.includes(openMarker)) { console.error('index return-open transform failed'); process.exit(1) }
  t = t.replace(openMarker, '  return (\n    <ApiBaseContext.Provider value={apiBase}>\n      <div className="space-y-5">')
  const closeMarker = '\n    </div>\n  )\n}'
  const lastClose = t.lastIndexOf(closeMarker)
  if (lastClose === -1) { console.error('index return-close transform failed'); process.exit(1) }
  t = t.slice(0, lastClose) + '\n      </div>\n    </ApiBaseContext.Provider>\n  )\n}' + t.slice(lastClose + closeMarker.length)
  g.text = t
}

/* 4c. Components that fetch — consume useApiBase() */
const FETCHERS = [
  'EvidenceUploadSection', 'FormEvidenceAttachSection',
  'Level1EnergyForm', 'Level2WaterForm', 'Level3GhgForm', 'Level4WasteForm',
  'Level5SafetyForm', 'Level6TrainingForm', 'Level7ComplianceForm',
  'Level8IncidentsForm', 'Level9InitiativesForm',
]
for (const fname of FETCHERS) {
  const home = HOMES[fname]
  const g = buckets[home].find((x) => x.name === fname)
  const bodyLines = g.text.split('\n')
  let declIdx = bodyLines.findIndex((l) => new RegExp(`(?:export )?function ${fname}\\(`).test(l))
  if (declIdx === -1) { console.error(`decl not found for ${fname}`); process.exit(1) }
  let closeIdx = -1
  for (let k = declIdx; k < bodyLines.length; k++) {
    if (/\)\s*\{\s*$/.test(bodyLines[k])) { closeIdx = k; break }
  }
  if (closeIdx === -1) { console.error(`signature close not found for ${fname}`); process.exit(1) }
  bodyLines.splice(closeIdx + 1, 0, '  const apiBase = useApiBase()', '')
  g.text = bodyLines.join('\n').replace(/fetch\('\/api\/pu\/([^']*)'/g, 'fetch(`${apiBase}/$1`')
}

/* ---------------- 5. Import computation ---------------- */
const relPrefix = (fileKey) => (FILE_BY_KEY[fileKey].startsWith('forms/') ? '../../' : '../')
const corePath = (fileKey) => (FILE_BY_KEY[fileKey].startsWith('forms/') ? '../core' : './core')

function rewriteModule(mod, fileKey) {
  if (mod.startsWith('./')) return relPrefix(fileKey) + mod.slice(2)
  if (mod === '@/components/pu/modules/csv-import-dialog') return relPrefix(fileKey) + 'csv-import-dialog'
  return mod
}

const FORCE_REACT = { core: ['createContext', 'useContext'] }

function buildImports(fileKey, bodyText) {
  const imports = new Map() // module -> Map(name -> typeOnly)
  const add = (mod, name, typeOnly) => {
    if (!imports.has(mod)) imports.set(mod, new Map())
    imports.get(mod).set(name, typeOnly || false)
  }
  /* cross-file registry symbols */
  for (const [sym, home] of Object.entries(HOMES)) {
    if (FILE_BY_KEY[home] === FILE_BY_KEY[fileKey]) continue
    if (new RegExp(`\\b${sym}\\b`).test(bodyText)) {
      const mod = home === 'core' ? corePath(fileKey) : relPrefix(fileKey) + FILE_BY_KEY[home].replace(/\.tsx$/, '').replace(/^forms\//, 'forms/')
      add(mod, sym, TYPE_ONLY.has(sym))
    }
  }
  /* external modules from the original header */
  for (const imp of extImports) {
    if (imp.module === '@/lib/pu/auth-context') continue // replaced by props
    for (const n of imp.names) {
      if (new RegExp(`\\b${n.name}\\b`).test(bodyText)) add(rewriteModule(imp.module, fileKey), n.name, n.typeOnly)
    }
  }
  for (const extra of FORCE_REACT[fileKey] || []) add('react', extra, false)

  const order = (m) => (m === 'react' ? 0 : m === 'framer-motion' ? 1 : m === 'lucide-react' ? 2 : m === 'sonner' ? 3 : 4)
  const out = []
  for (const mod of [...imports.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b))) {
    const names = [...imports.get(mod).entries()]
    const valueNames = names.filter(([, t]) => !t).map(([n]) => n)
    const typeNamesL = names.filter(([, t]) => t).map(([n]) => n)
    const inline = [
      valueNames.length ? valueNames.join(', ') : '',
      typeNamesL.length ? typeNamesL.map((n) => `type ${n}`).join(', ') : '',
    ].filter(Boolean).join(', ')
    out.push(`import { ${inline} } from '${mod}'`)
  }
  return out.join('\n')
}

/* ---------------- 6. Emit files ---------------- */
mkdirSync(OUTDIR, { recursive: true })
mkdirSync(join(OUTDIR, 'forms'), { recursive: true })

for (const [fileKey, fileName] of Object.entries(FILE_BY_KEY)) {
  const gs = buckets[fileKey]
  if (!gs || !gs.length) { console.error(`empty bucket: ${fileKey}`); process.exit(1) }
  const body = gs.map((g) => g.text.trimEnd()).join('\n\n')
  const imports = buildImports(fileKey, body)
  const header = ["'use client'"]
  if (fileKey === 'index' && docComment) header.push('', docComment)
  let text = [...header, '', imports, '', body].join('\n')
  if (fileKey === 'index') {
    text += [
      '',
      '/* Backwards-compatible exports for console module-routers */',
      "export { SUB_MODULES, normalizeSubModule } from './core'",
      "export type { LevelKey, LevelConfig, EvidenceItem, SavedRecord } from './core'",
      '',
    ].join('\n')
  }
  writeFileSync(join(OUTDIR, fileName), text.replace(/\n/g, EOL))
  console.log(`wrote src/components/shared/data-entry/${fileName} (${body.split('\n').length} lines)`)
}

/* Sanity: no useApp references may remain anywhere */
for (const fileName of Object.values(FILE_BY_KEY)) {
  const t = readFileSync(join(OUTDIR, fileName), 'utf8')
  if (/useApp|@\/lib\/pu\/auth-context/.test(t)) {
    console.error(`FATAL: ${fileName} still references useApp / pu auth-context`)
    process.exit(1)
  }
}
console.log('OK')
