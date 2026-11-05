// Rewires the stale route-path cache imports to @/lib/portal-cache.
const { readFileSync, writeFileSync } = require('node:fs')

const files = [
  'src/app/api/project-admin/submissions/route.ts',
  'src/app/api/pu/data-entry/route.ts',
  'src/app/api/pu/data-entry/submit-all/route.ts',
  'src/app/api/pu/notifications/[id]/read/route.ts',
  'src/app/api/pu/submissions/[id]/submit/route.ts',
]

const RE = /import \{([^}]*)\} from ['"]@\/app\/api\/pu\/(?:overview|submissions|notifications|evidence|organization\/tree)\/route['"];?\r?\n/g

for (const p of files) {
  let t = readFileSync(p, 'utf8')
  const before = t
  const collected = new Set()
  t = t.replace(RE, (m, names) => {
    for (const n of names.split(',')) {
      const name = n.trim()
      if (name) collected.add(name)
    }
    return ''
  })
  if (collected.size) {
    // merge into an existing portal-cache import if present, else add one after the last import
    const mergeRe = /import \{([^}]*)\} from '@\/lib\/portal-cache'\n/
    if (mergeRe.test(t)) {
      t = t.replace(mergeRe, (m, names) => {
        for (const n of names.split(',')) {
          const name = n.trim()
          if (name) collected.add(name)
        }
        return `import { ${[...collected].join(', ')} } from '@/lib/portal-cache'\n`
      })
    } else {
      const lines = t.split('\n')
      let lastImport = -1
      for (let i = 0; i < lines.length; i++) if (/^import /.test(lines[i])) lastImport = i
      lines.splice(lastImport + 1, 0, `import { ${[...collected].join(', ')} } from '@/lib/portal-cache'`)
      t = lines.join('\n')
    }
  }
  if (t !== before) { writeFileSync(p, t); console.log('rewired', p) }
  else console.log('no change', p)
}

// overview route: CACHE_CONTROL constant is now OVERVIEW_CACHE_CONTROL
{
  const p = 'src/app/api/pu/overview/route.ts'
  let t = readFileSync(p, 'utf8')
  if (t.includes('CACHE_CONTROL }')) {
    t = t.split("'Cache-Control': CACHE_CONTROL }").join("'Cache-Control': OVERVIEW_CACHE_CONTROL }")
    writeFileSync(p, t)
    console.log('overview CACHE_CONTROL renamed')
  }
}
console.log('done')
