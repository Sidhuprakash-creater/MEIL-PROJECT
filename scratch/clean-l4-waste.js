// Blanks fabricated data in the Level 4 waste form (keeps draft restore + type defaults).
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/data-entry/forms/level4-waste.tsx'
let t = readFileSync(p, 'utf8')
let n = 0

const swaps = [
  // draft-restore fallbacks
  ["wasteTypeDescription: initial.wasteTypeDescription || 'Concrete rubble, brickbats, excavated soil & tile scrap',", "wasteTypeDescription: initial.wasteTypeDescription || '',"],
  ["quantityReused: initial.quantityReused || '10.50',", "quantityReused: initial.quantityReused || '',"],
  ["quantityRecycled: initial.quantityRecycled || '5.20',", "quantityRecycled: initial.quantityRecycled || '',"],
  ["quantityRecovered: initial.quantityRecovered || '0.00',", "quantityRecovered: initial.quantityRecovered || '',"],
  ["quantityDisposed: initial.quantityDisposed || '1.50',", "quantityDisposed: initial.quantityDisposed || '',"],
  ["wasteHandler: initial.wasteHandler || 'Green Earth Recycling & Aggregates Pvt. Ltd.',", "wasteHandler: initial.wasteHandler || '',"],
  ["authorizationReference: initial.authorizationReference || 'SPCB/CDW/AUTH/2026/102',", "authorizationReference: initial.authorizationReference || '',"],
  ["transferManifestNumber: initial.transferManifestNumber || 'CDW-MANIFEST-2026-0102',", "transferManifestNumber: initial.transferManifestNumber || '',"],
  ["supportingEvidence: initial.supportingEvidence || 'Weighbridge Slips & C&D Processing Plant Receipt',", "supportingEvidence: initial.supportingEvidence || '',"],
  ["remarks: initial.remarks || 'Construction scrap processed at authorized recycling plant.',", "remarks: initial.remarks || '',"],
]
for (const [a, b] of swaps) { if (t.includes(a)) { t = t.split(a).join(b); n++ } else console.error('MISS restore:', a.slice(0, 50)) }

// remove the whole "Seed standard initial item" fallback (from its comment to the closing `]`)
const startMarker = "    // Seed standard initial item so form is immediately usable"
const start = t.indexOf(startMarker)
if (start !== -1) {
  const close = t.indexOf('  })', start)
  if (close === -1) { console.error('close not found'); process.exit(1) }
  t = t.slice(0, start) + '    // Blank until the user stages an item\n    return []\n' + t.slice(close + 4).replace(/^\n/, '')
  n++
}

// field defaults → blank (type defaults stay)
const blankDefaults = [
  ["const [wasteTypeDescription, setWasteTypeDescription] = useState(\n    'Concrete rubble, brickbats, excavated soil & tile scrap'\n  )", "const [wasteTypeDescription, setWasteTypeDescription] = useState('')"],
  ["const [quantityGenerated, setQuantityGenerated] = useState('17.20')", "const [quantityGenerated, setQuantityGenerated] = useState('')"],
  ["const [quantityReused, setQuantityReused] = useState('10.50')", "const [quantityReused, setQuantityReused] = useState('')"],
  ["const [quantityRecycled, setQuantityRecycled] = useState('5.20')", "const [quantityRecycled, setQuantityRecycled] = useState('')"],
  ["const [quantityRecovered, setQuantityRecovered] = useState('0.00')", "const [quantityRecovered, setQuantityRecovered] = useState('')"],
  ["const [quantityDisposed, setQuantityDisposed] = useState('1.50')", "const [quantityDisposed, setQuantityDisposed] = useState('')"],
  ["const [wasteHandler, setWasteHandler] = useState('Green Earth Recycling & Aggregates Pvt. Ltd.')", "const [wasteHandler, setWasteHandler] = useState('')"],
  ["const [authorizationReference, setAuthorizationReference] = useState('SPCB/CDW/AUTH/2026/102')", "const [authorizationReference, setAuthorizationReference] = useState('')"],
  ["const [transferManifestNumber, setTransferManifestNumber] = useState('CDW-MANIFEST-2026-0102')", "const [transferManifestNumber, setTransferManifestNumber] = useState('')"],
  ["const [supportingEvidence, setSupportingEvidence] = useState(\n    'Weighbridge Slips & C&D Processing Plant Receipt'\n  )", "const [supportingEvidence, setSupportingEvidence] = useState('')"],
  ["const [remarks, setRemarks] = useState(\n    'Total waste 36.68 T; 29.80 T diverted/recycled (81.2% circular recovery); 6.88 T safely disposed per CPCB regulations.'\n  )", "const [remarks, setRemarks] = useState('')"],
]
for (const [a, b] of blankDefaults) { if (t.includes(a)) { t = t.split(a).join(b); n++ } else console.error('MISS default:', a.slice(0, 60)) }

writeFileSync(p, t)
console.log('L4 cleaned, edits:', n)
