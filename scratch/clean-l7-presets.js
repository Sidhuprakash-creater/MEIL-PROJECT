// L7: drop fabricated sample permit numbers; keep authority/validity as type defaults.
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/data-entry/forms/level7-compliance.tsx'
let t = readFileSync(p, 'utf8')

t = t.replace(/\n    sampleNo: string\n/, '\n')
t = t.replace(/^    sampleNo: '[^']*',\n/gm, '')
t = t.replace(
  /      if \(!permitNumber \|\| permitNumber\.startsWith\('TSPCB\/'\)\) \{\n        setPermitNumber\(preset\.sampleNo\)\n      \}\n/,
  '',
)
t = t.split('placeholder="e.g. TSPCB/HYD/CTO/2026-8941"').join('placeholder="e.g. SPCB/CTO/2026-#### (from consent letter)"')
writeFileSync(p, t)
const leftover = (t.match(/sampleNo|TSPCB\/HYD\/CTO\/2026-8941/g) || []).length
console.log('L7 sample permit numbers removed; leftover:', leftover)
