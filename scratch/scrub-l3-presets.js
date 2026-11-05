// Removes now-dead fabricated fields from the L3 GHG preset table.
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/data-entry/forms/level3-ghg.tsx'
let t = readFileSync(p, 'utf8')

// interface members (2-space indent)
t = t.replace(/\n  location: string\n/, '')
t = t.replace(/\n  equipmentId: string\n/, '')
t = t.replace(/\n  lab: string\n/, '')
t = t.replace(/\n  defaultQty: string\n/, '')
t = t.replace(/\n  defaultResult: string\n/, '')

// entry members (4-space indent)
t = t.replace(/^    location: '[^']*',\n/gm, '')
t = t.replace(/^    equipmentId: '[^']*',\n/gm, '')
t = t.replace(/^    lab: '[^']*',\n/gm, '')
t = t.replace(/^    defaultQty: '[^']*',\n/gm, '')
t = t.replace(/^    defaultResult: '[^']*',\n/gm, '')

writeFileSync(p, t)
const leftover = (t.match(/defaultQty|defaultResult|preset\.location|preset\.equipmentId|preset\.lab/g) || []).length
console.log('L3 preset fields scrubbed; leftover refs:', leftover)
