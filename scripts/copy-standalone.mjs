// Cross-platform post-build step: copy static assets + public into the
// Next.js standalone output. Replaces `cp -r` (not available on Windows).
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')
const standaloneNext = join(standalone, '.next')
const staticSrc = join(root, '.next', 'static')
const staticDst = join(standaloneNext, 'static')
const publicSrc = join(root, 'public')
const publicDst = join(standalone, 'public')

if (!existsSync(standaloneNext)) {
  mkdirSync(standaloneNext, { recursive: true })
}

cpSync(staticSrc, staticDst, { recursive: true })
cpSync(publicSrc, publicDst, { recursive: true })

console.log(`[copy-standalone] copied .next/static -> .next/standalone/.next/static`)
console.log(`[copy-standalone] copied public -> .next/standalone/public`)
