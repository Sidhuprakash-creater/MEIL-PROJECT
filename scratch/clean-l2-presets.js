// Cleans fabricated demo data out of the Level 2 water form presets.
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/data-entry/forms/level2-water.tsx'
let t = readFileSync(p, 'utf8')

// 1. interface fields out
t = t.replace(/\n    meter: string\n/, '')
t = t.replace(/\n    reused: string\n/, '')
t = t.replace(/\n    quality: string\n/, '')
t = t.replace(/\n    testLab: string\n/, '')
t = t.replace(/\n    defaultQty: string\n/, '')

// 2. preset entry fields out
t = t.replace(/^    meter: '[^']*',\n/gm, '')
t = t.replace(/^    reused: '[^']*',\n/gm, '')
t = t.replace(/^    quality: '[^']*',\n/gm, '')
t = t.replace(/^    testLab: '[^']*',\n/gm, '')
t = t.replace(/^    defaultQty: '[^']*',\n/gm, '')

// 3. select-handler: drop fabricated setters (remarks keep type-free blank)
t = t.replace(/\n      setWaterQuantity\(preset\.defaultQty\)/, '')
t = t.replace(/\n      setMeterSourceId\(preset\.meter\)/, '')
t = t.replace(/\n      setWaterReusedRecycled\(preset\.reused\)/, '')
t = t.replace(/\n      setWaterQualityResult\(preset\.quality\)/, '')
t = t.replace(/\n      setTestDateLab\(preset\.testLab\)/, '')
t = t.replace(/setRemarks\(`Measured intake for \$\{src\} per site meters\.`\)/, "setRemarks('')")

// 4. placeholders → neutral hints
t = t.split('placeholder="e.g. 24500"').join('placeholder="Withdrawal quantity for the period"')
t = t.split('placeholder="e.g. CGWA-BW-01-MTR"').join('placeholder="Meter / pump ID"')
t = t.split('placeholder="e.g. 6200"').join('placeholder="Reused / recycled quantity"')
t = t.split('placeholder="e.g. 82400"').join('placeholder="Meter opening reading"')
t = t.split('placeholder="e.g. 106900"').join('placeholder="Meter closing reading"')
t = t.split('placeholder="e.g. TDS: 420 mg/L, pH: 7.2 (Compliant)"').join('placeholder="e.g. pH 7.2, TDS 420 mg/L — from lab report"')
t = t.split('placeholder="e.g. 2026-09-15 · SGS Environmental Testing"').join('placeholder="YYYY-MM-DD · Laboratory name"')

writeFileSync(p, t)
console.log('L2 presets cleaned')
