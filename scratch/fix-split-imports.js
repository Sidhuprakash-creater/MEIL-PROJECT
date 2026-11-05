// Post-split fixer: repairs the four systematic import-generation issues.
const { readFileSync, writeFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const dir = 'src/components/shared/data-entry'
const rootFiles = ['index.tsx', 'primitives.tsx', 'evidence.tsx', 'evidence-attach.tsx', 'engine-evidence-panel.tsx', 'states.tsx']
const formFiles = readdirSync(join(dir, 'forms')).map((f) => 'forms/' + f)
const GENERATED = /^(primitives|states|evidence|evidence-attach|engine-evidence-panel|core)(\.tsx)?$/

/* 1a. Root files: '../X' -> './X' for generated siblings (satellites stay '../') */
for (const f of rootFiles) {
  const p = join(dir, f)
  let t = readFileSync(p, 'utf8')
  const nt = t.replace(/from '\.\.\/([^'.]+)'/g, (m, spec) => {
    if (GENERATED.test(spec)) return `from './${spec}'`
    return m
  })
  if (nt !== t) { writeFileSync(p, nt); console.log('1a', f) }
}

/* 1b. Forms: '../../X' -> '../X' for generated modules (satellites stay '../../') */
for (const f of formFiles) {
  const p = join(dir, f)
  let t = readFileSync(p, 'utf8')
  const nt = t.replace(/from '\.\.\/\.\.\/([^'.]+)'/g, (m, spec) => {
    if (GENERATED.test(spec)) return `from '../${spec}'`
    return m
  })
  if (nt !== t) { writeFileSync(p, nt); console.log('1b', f) }
}

/* 2. core.tsx: export the cross-file types/consts */
{
  const p = join(dir, 'core.tsx')
  let t = readFileSync(p, 'utf8')
  for (const decl of ['interface Project {', 'interface Period {', 'interface ValidationIssue {', 'interface CalcPayload {', 'interface SavedRecord {', 'const READ_ONLY_ROLES', 'const STEPS']) {
    t = t.replace(decl, 'export ' + decl)
  }
  writeFileSync(p, t)
  console.log('2 core.tsx exports added')
}

/* 3. Add useApiBase (and ApiBaseContext for index) to the core import */
const CORE_HOOK = "useApiBase"
for (const f of [...rootFiles, ...formFiles]) {
  if (f === 'core.tsx' || f === 'states.tsx' || f === 'primitives.tsx' || f === 'engine-evidence-panel.tsx') continue
  const p = join(dir, f)
  let t = readFileSync(p, 'utf8')
  if (!/\buseApiBase\b/.test(t)) continue
  const need = f === 'index.tsx' ? ['useApiBase', 'ApiBaseContext'] : ['useApiBase']
  const coreMod = f.startsWith('forms/') ? '../core' : './core'
  const re = new RegExp("import \\{([^}]*)\\} from '" + coreMod.replace(/\//g, '\\/') + "'")
  const m = t.match(re)
  if (m) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    for (const n of need) if (!names.includes(n)) names.push(n)
    t = t.replace(re, `import { ${names.join(', ')} } from '${coreMod}'`)
  } else {
    // insert a new import after the last top-of-file import line
    const lines = t.split('\n')
    let last = 0
    for (let i = 0; i < 40 && i < lines.length; i++) if (/^import /.test(lines[i])) last = i
    lines.splice(last + 1, 0, `import { ${need.join(', ')} } from '${coreMod}'`)
    t = lines.join('\n')
  }
  writeFileSync(p, t)
  console.log('3', f)
}

/* 4. lucide alias: Image as ImageIcon */
for (const f of ['evidence.tsx', 'evidence-attach.tsx']) {
  const p = join(dir, f)
  let t = readFileSync(p, 'utf8')
  if (!/\bImageIcon\b/.test(t)) continue
  if (/import \{[^}]*Image as ImageIcon/.test(t)) continue
  t = t.replace(/\} from 'lucide-react'/, '  Image as ImageIcon,\n} from \'lucide-react\'')
  writeFileSync(p, t)
  console.log('4', f)
}
console.log('done')
