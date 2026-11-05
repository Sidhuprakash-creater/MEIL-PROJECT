// Round 2: catch the leftover drift sites with their exact current text.
const { readFileSync, writeFileSync } = require('node:fs')

function patch(p, fn) {
  let t = readFileSync(p, 'utf8')
  const nt = fn(t)
  if (nt !== t) { writeFileSync(p, nt); console.log('patched', p) }
  else console.log('NO CHANGE', p)
}

// 1. ba/evidence/[id]/route.ts — leftover previewAvailable/contentHash referencing d.fileId
patch('src/app/api/ba/evidence/[id]/route.ts', (t) => t
  .replace("      previewAvailable: !!d.fileId, // real bytes can be downloaded; legacy rows are metadata-only", "      previewAvailable: false, // EvidenceDoc is metadata-only in the unified schema"))

// 2. download routes — drop the d.fileId bytes branch (exact current text)
const dropBytes = (t) => t.replace(/    \/\* Real bytes when the document was uploaded with stored content[\s\S]*?\n    \}\n\n/, '')
patch('src/app/api/ba/evidence/[id]/download/route.ts', dropBytes)
patch('src/app/api/bm/evidence/[id]/download/route.ts', dropBytes)

// 3. sa/types.ts EvidenceRow tail (line 245: uploadedAt: string; then '}')
patch('src/lib/sa/types.ts', (t) => t.replace(
  /  uploadedBy: string;\n  status: string;\n  uploadedAt: string;\n\}/,
  '  uploadedBy: string;\n  status: string;\n  uploadedAt: string;\n  /* Legacy file-storage link (EvidenceDoc is metadata-only in the unified schema). */\n  fileId?: string | null;\n  hasFile?: boolean;\n  mimeType?: string;\n}',
))
console.log('done')
