// L4 category handler: type defaults only; scrub dead fabricated preset fields.
const { readFileSync, writeFileSync } = require('node:fs')
const p = 'src/components/shared/data-entry/forms/level4-waste.tsx'
let t = readFileSync(p, 'utf8')

const oldBlock = `      setWasteTypeDescription(preset.desc)
      setQuantityGenerated(preset.defaultGen)
      setUnit(preset.unit)
      setQuantityReused(preset.defaultReused)
      setQuantityRecycled(preset.defaultRecycled)
      setQuantityRecovered(preset.defaultRecovered)
      setQuantityDisposed(preset.defaultDisposed)
      setDisposalMethod(preset.method)
      setWasteHandler(preset.handler)
      setAuthorizationReference(preset.authRef)
      setTransferManifestNumber(preset.manifest)
      setSupportingEvidence(preset.doc)
      setRemarks(\`Measured generation and handling for \${cat} per site manifests.\`)
      setEvidenceId('')`

const newBlock = `      // Type defaults only — quantities, handlers, references and remarks
      // are never fabricated; the user enters actual measured values.
      setWasteTypeDescription('')
      setQuantityGenerated('')
      setUnit(preset.unit)
      setQuantityReused('')
      setQuantityRecycled('')
      setQuantityRecovered('')
      setQuantityDisposed('')
      setDisposalMethod(preset.method)
      setWasteHandler('')
      setAuthorizationReference('')
      setTransferManifestNumber('')
      setSupportingEvidence('')
      setRemarks('')
      setEvidenceId('')`

if (!t.includes(oldBlock)) { console.error('L4 handler block not found'); process.exit(1) }
t = t.split(oldBlock).join(newBlock)

// scrub dead preset fields (interface 2-space + entries 4-space)
for (const key of ['handler', 'authRef', 'manifest', 'defaultGen', 'defaultReused', 'defaultRecycled', 'defaultRecovered', 'defaultDisposed']) {
  t = t.replace(new RegExp(`\\n  ${key}: string\\n`), '\n')
  t = t.replace(new RegExp(`^    ${key}: '[^']*',\\n`, 'gm'), '')
}
writeFileSync(p, t)
const leftover = (t.match(/defaultGen|defaultReused|defaultRecycled|defaultRecovered|defaultDisposed|preset\.handler|preset\.authRef|preset\.manifest/g) || []).length
console.log('L4 handler cleaned; leftover preset refs:', leftover)
