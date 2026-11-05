// Repairs the codemod's fetch rewrite: the original closing quote survived,
// producing fetch(`${apiBase}/path', ...) instead of fetch(`${apiBase}/path`, ...)
const { readFileSync, writeFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const dir = 'src/components/shared/data-entry'
const files = ['index.tsx', 'evidence.tsx', 'evidence-attach.tsx']
for (const f of readdirSync(join(dir, 'forms'))) files.push('forms/' + f)

const BROKEN = /fetch\(`\$\{apiBase\}\/([^`]*)'/g
let total = 0
for (const f of files) {
  const p = join(dir, f)
  const t = readFileSync(p, 'utf8')
  const matches = t.match(/fetch\(`\$\{apiBase\}\/[^`]*'/g) || []
  if (!matches.length) continue
  const nt = t.replace(BROKEN, 'fetch(`${apiBase}/$1`')
  writeFileSync(p, nt)
  total += matches.length
  console.log('fixed', matches.length, 'in', f)
}
console.log('total repaired:', total)
