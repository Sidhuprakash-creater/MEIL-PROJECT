// Reverse-repairs the generated data-entry files.
// Damage model (per fetch site):
//   1. fix-fetch-literals.js greedily matched (multi-line, no backticks) from
//      `fetch(`${apiBase}/` to the last `'` before the next backtick, turning
//      that terminal `'` into a backtick. => the FIRST backtick after each
//      fetch start today is that inserted one; it must become `'` again.
//   2. The codemod left the original closing quote after the path:
//      `fetch(`${apiBase}/path',` => must be `fetch(`${apiBase}/path`,`
const { readFileSync, writeFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const dir = 'src/components/shared/data-entry'
const files = ['index.tsx', 'evidence.tsx', 'evidence-attach.tsx']
for (const f of readdirSync(join(dir, 'forms'))) files.push('forms/' + f)

const MARK = 'fetch(`${apiBase}/'
let totalQuotes = 0
let totalPaths = 0
for (const f of files) {
  const p = join(dir, f)
  let t = readFileSync(p, 'utf8')

  // step 1: inserted backtick -> original single quote
  let pos = 0
  let quotes = 0
  for (;;) {
    const s = t.indexOf(MARK, pos)
    if (s === -1) break
    const bt = t.indexOf('`', s + MARK.length)
    if (bt === -1) break
    t = t.slice(0, bt) + "'" + t.slice(bt + 1)
    pos = bt + 1
    quotes++
  }

  // step 2: stray quote directly after the request path -> backtick
  const before = t
  t = t.replace(/(`\$\{apiBase\}\/[a-z0-9\-\/]+)'/g, '$1`')
  const paths = (before.match(/(`\$\{apiBase\}\/[a-z0-9\-\/]+)'/g) || []).length

  if (quotes || paths) {
    writeFileSync(p, t)
    console.log(f, '-> restored quotes:', quotes, ', path fixes:', paths)
  }
  totalQuotes += quotes
  totalPaths += paths
}
console.log('TOTAL quote restorations:', totalQuotes, '| path fixes:', totalPaths)
