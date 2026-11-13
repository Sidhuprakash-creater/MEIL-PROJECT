/**
 * Gemini OCR extraction — server-side helper (called from API routes only).
 *
 * Plain `fetch` to the Gemini REST API (no SDK dependency). Sends the document
 * as inline base64 and asks for a strictly-structured JSON extraction of the
 * fields our data-entry forms capture. Never guesses: fields the model cannot
 * read come back as null and the UI shows them as "not found".
 */

export interface OcrFields {
  docType: string | null
  invoiceNo: string | null
  date: string | null
  expiryDate?: string | null
  sourceName: string | null
  supplierOrVendor?: string | null
  quantity: string | null
  unit: string | null
  monetaryAmount?: string | null
  meterOpening: string | null
  meterClosing: string | null
  meterId: string | null
  labName: string | null
  testResult: string | null
  destinationOrMethod?: string | null
  notes: string | null
  confidence: 'high' | 'medium' | 'low'
}

export interface OcrResult {
  ok: boolean
  keyMissing?: boolean
  error?: string
  fields?: OcrFields
  rawText?: string
}

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']

const EXTRACTION_PROMPT = `You are an expert data-extraction engine for MEIL (Megha Engineering & Infrastructures Ltd) industrial ESG & BRSR reporting platform.
Analyze this utility bill, fuel challan/register, meter log, water analysis/tanker slip, hazardous waste manifest, emission test certificate, environmental permit, or site log.

Extract the relevant operational and ESG disclosure values with high precision.
Rules:
- Read ONLY what is actually visible in the document. If a field is not present or cannot be read, return null for it.
- Numbers: return digits and optional decimal only (strip out commas, currency symbols, and extra text like "/-"). Example: "4500", "12450.50".
- Dates: return ISO format (YYYY-MM-DD) whenever a date is visible.
- Units: keep the standard engineering/ESG unit as written or abbreviated (e.g. "kWh", "MWh", "litres", "kL", "m³", "metric tonnes", "kg", "GJ", "tonne-km").
- Source Name: Identify the utility, material, fuel, pollutant, or permit name (e.g. "Grid electricity", "Diesel (HSD)", "Petrol", "Groundwater", "Surface water", "Used Oil", "Hazardous Waste", "Consent to Operate (CTO)", "PM10 / PM2.5").
- Confidence: "high" if the core quantity/date/source is clearly legible; "medium" if partially legible or handwritten; "low" if blurry or uncertain.

Return a single JSON object with EXACTLY these keys:
{
  "docType": "INVOICE" | "METER_READING" | "LAB_REPORT" | "DELIVERY_CHALLAN" | "REGISTER" | "PERMIT_CONSENT" | "CERTIFICATE" | "OTHER",
  "invoiceNo": string | null,
  "date": string | null,
  "expiryDate": string | null,
  "sourceName": string | null,
  "supplierOrVendor": string | null,
  "quantity": string | null,
  "unit": string | null,
  "monetaryAmount": string | null,
  "meterOpening": string | null,
  "meterClosing": string | null,
  "meterId": string | null,
  "labName": string | null,
  "testResult": string | null,
  "destinationOrMethod": string | null,
  "notes": string | null,
  "confidence": "high" | "medium" | "low"
}`

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

function cleanNumeric(v: any): string | null {
  if (v == null) return null
  const s = String(v).replace(/,/g, '').trim()
  const m = s.match(/-?\d+(?:\.\d+)?/)
  return m ? m[0] : null
}

function cleanDate(v: any): string | null {
  if (!v || typeof v !== 'string') return null
  const s = v.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    const year = dmy[3]
    return `${year}-${month}-${day}`
  }
  return s
}

export async function runGeminiOcr(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, keyMissing: true, error: 'GEMINI_API_KEY is not configured on the server.' }
  }
  if (buffer.length > 20 * 1024 * 1024) {
    return { ok: false, error: 'File too large for AI scanning (max 20 MB).' }
  }

  const modelsToTry = Array.from(new Set([PRIMARY_MODEL, ...FALLBACK_MODELS]))

  const body = {
    contents: [
      {
        parts: [
          { text: EXTRACTION_PROMPT },
          { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ],
  }

  let lastError = 'AI scan failed'

  for (const model of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45000),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        lastError = data?.error?.message || `Gemini API error (${res.status}) on model ${model}`
        // If model not found (404), continue to next fallback model
        if (res.status === 404 || lastError.toLowerCase().includes('not found') || lastError.toLowerCase().includes('no longer available')) {
          continue
        }
        return { ok: false, error: lastError }
      }

      // Collect text from candidate parts (excluding thinking blocks if present)
      const parts = data?.candidates?.[0]?.content?.parts || []
      const textParts: string[] = []
      for (const p of parts) {
        if (p?.text && !p?.thought) {
          textParts.push(p.text)
        }
      }
      let raw = textParts.join('').trim()
      if (!raw) {
        // Fallback to all parts if no non-thought part
        raw = parts.map((p: any) => p?.text).filter(Boolean).join('').trim()
      }

      if (!raw) {
        const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason
        if (blockReason) {
          lastError = `Gemini returned ${blockReason} for this document.`
          continue
        }
        return { ok: false, error: 'Gemini returned no content for this document.' }
      }

      // Clean Markdown code fence if returned
      const cleanJson = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      let parsed: any
      try {
        parsed = JSON.parse(cleanJson)
      } catch {
        const m = cleanJson.match(/\{[\s\S]*\}/)
        if (!m) return { ok: false, error: 'Could not parse the extraction result.', rawText: cleanJson.slice(0, 500) }
        parsed = JSON.parse(m[0])
      }

      const allowedTypes = new Set([
        'INVOICE',
        'METER_READING',
        'LAB_REPORT',
        'DELIVERY_CHALLAN',
        'REGISTER',
        'PERMIT_CONSENT',
        'CERTIFICATE',
        'OTHER',
      ])

      const conf = ['high', 'medium', 'low'].includes(parsed?.confidence) ? parsed.confidence : 'medium'

      const fields: OcrFields = {
        docType: allowedTypes.has(parsed?.docType) ? parsed.docType : parsed?.docType ? 'OTHER' : null,
        invoiceNo: parsed?.invoiceNo ? String(parsed.invoiceNo).trim() : null,
        date: cleanDate(parsed?.date),
        expiryDate: cleanDate(parsed?.expiryDate),
        sourceName: parsed?.sourceName ? String(parsed.sourceName).trim() : null,
        supplierOrVendor: parsed?.supplierOrVendor ? String(parsed.supplierOrVendor).trim() : null,
        quantity: cleanNumeric(parsed?.quantity),
        unit: parsed?.unit ? String(parsed.unit).trim() : null,
        monetaryAmount: cleanNumeric(parsed?.monetaryAmount),
        meterOpening: cleanNumeric(parsed?.meterOpening),
        meterClosing: cleanNumeric(parsed?.meterClosing),
        meterId: parsed?.meterId ? String(parsed.meterId).trim() : null,
        labName: parsed?.labName ? String(parsed.labName).trim() : null,
        testResult: parsed?.testResult ? String(parsed.testResult).trim() : null,
        destinationOrMethod: parsed?.destinationOrMethod ? String(parsed.destinationOrMethod).trim() : null,
        notes: parsed?.notes ? String(parsed.notes).trim() : null,
        confidence: conf,
      }

      return { ok: true, fields, rawText: raw }
    } catch (e: any) {
      lastError = e?.name === 'TimeoutError' ? 'AI scan timed out — try a smaller/clearer file.' : e?.message || 'AI scan failed'
    }
  }

  return { ok: false, error: lastError }
}
