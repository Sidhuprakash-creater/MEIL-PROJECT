// Wires the Gemini OCR apply-callback into the L1/L2/L3/L4 level forms.
const { readFileSync, writeFileSync } = require('node:fs')

const APPLICATIONS = {
  'src/components/shared/data-entry/forms/level1-energy.tsx': `onOcrApply={(f) => {
                if (f.quantity) setConsumptionQuantity(f.quantity)
                if (f.meterOpening) setOpeningMeterReading(f.meterOpening)
                if (f.meterClosing) setClosingMeterReading(f.meterClosing)
                if (f.meterId) setMeterEquipmentId(f.meterId)
                if (f.unit && L1_UNITS.includes(f.unit)) setUnit(f.unit)
                const bits = [f.invoiceNo && \`Ref \${f.invoiceNo}\`, f.date, f.notes].filter(Boolean)
                if (bits.length) setRemarks(bits.join(' · '))
                toast.success('AI-extracted fields applied — review before adding the draft')
              }}`,
  'src/components/shared/data-entry/forms/level2-water.tsx': `onOcrApply={(f) => {
                if (f.quantity) setWaterQuantity(f.quantity)
                if (f.meterOpening) setOpeningReading(f.meterOpening)
                if (f.meterClosing) setClosingReading(f.meterClosing)
                if (f.meterId) setMeterSourceId(f.meterId)
                const quality = [f.labName, f.testResult].filter(Boolean).join(' — ')
                if (quality) setWaterQualityResult(quality)
                if (f.date) setTestDateLab(f.date)
                const bits = [f.invoiceNo && \`Ref \${f.invoiceNo}\`, f.notes].filter(Boolean)
                if (bits.length) setRemarks(bits.join(' · '))
                toast.success('AI-extracted fields applied — review before adding the draft')
              }}`,
  'src/components/shared/data-entry/forms/level3-ghg.tsx': `onOcrApply={(f) => {
                if (f.quantity) setActivityQuantity(f.quantity)
                if (f.labName) setLaboratory(f.labName)
                if (f.testResult) setMeasuredResult(f.testResult)
                if (f.date) setTestDate(f.date)
                const bits = [f.invoiceNo && \`Ref \${f.invoiceNo}\`, f.notes].filter(Boolean)
                if (bits.length) setRemarks(bits.join(' · '))
                toast.success('AI-extracted fields applied — review before adding the draft')
              }}`,
  'src/components/shared/data-entry/forms/level4-waste.tsx': `onOcrApply={(f) => {
                if (f.quantity) setQuantityGenerated(f.quantity)
                if (f.meterId) setTransferManifestNumber(f.meterId)
                const bits = [f.invoiceNo && \`Ref \${f.invoiceNo}\`, f.date, f.notes].filter(Boolean)
                if (bits.length) setRemarks(bits.join(' · '))
                toast.success('AI-extracted fields applied — review before adding the draft')
              }}`,
}

for (const [p, prop] of Object.entries(APPLICATIONS)) {
  let t = readFileSync(p, 'utf8')
  if (t.includes('onOcrApply=')) { console.log('skip (already wired):', p); continue }
  // insert the onOcrApply prop right before the section's readOnly prop
  const anchor = '              readOnly={readOnly}'
  const idx = t.indexOf(anchor)
  if (idx === -1) { console.error('anchor not found in', p); process.exit(1) }
  t = t.slice(0, idx) + prop + '\n' + t.slice(idx)
  writeFileSync(p, t)
  console.log('wired OCR into', p)
}
