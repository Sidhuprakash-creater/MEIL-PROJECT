// Fixes schema-drift errors in the legacy ba/bm evidence routes:
// EvidenceDoc no longer stores binary files, so fileId/hasFile/mimeType get
// honest metadata-only values, and download routes drop the dead bytes branch.
const { readFileSync, writeFileSync } = require('node:fs')

function patch(p, fns) {
  let t = readFileSync(p, 'utf8')
  const before = t
  for (const fn of fns) t = fn(t)
  if (t !== before) { writeFileSync(p, t); console.log('patched', p) }
  else console.log('no change', p)
}

const stripFileKeys = (t) => t
  .replace(/\n\s*fileId: d\.fileId,/g, '\n      fileId: null as string | null,')
  .replace(/\n\s*hasFile: !!d\.fileId,/g, '\n      hasFile: false,')
  .replace(/\n\s*mimeType: d\.mimeType,/g, "\n      mimeType: '',")

const dropBytesBranch = (t) => t
  .replace(/    \/\* Real bytes when the document was uploaded with stored content[\s\S]*?    \}\n\n/, '')

const files = [
  'src/app/api/ba/evidence/route.ts',
  'src/app/api/ba/evidence/[id]/route.ts',
  'src/app/api/ba/submissions/[id]/evidence/route.ts',
  'src/app/api/bm/evidence/route.ts',
  'src/app/api/bm/evidence/[id]/route.ts',
]
for (const f of files) patch(f, [stripFileKeys])

patch('src/app/api/ba/evidence/[id]/download/route.ts', [dropBytesBranch])
patch('src/app/api/bm/evidence/[id]/download/route.ts', [dropBytesBranch])

// EvidenceRow type gains the optional legacy fields
patch('src/lib/sa/types.ts', [(t) => t.replace(
  '  uploadedBy: string;\n  status: string;\n  uploadedAt: string;\n}',
  '  uploadedBy: string;\n  status: string;\n  uploadedAt: string;\n  /* Legacy file-storage link (EvidenceDoc is metadata-only in the unified schema). */\n  fileId?: string | null;\n  hasFile?: boolean;\n  mimeType?: string;\n}',
)])
console.log('done')
