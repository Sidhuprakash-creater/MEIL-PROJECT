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
  sourceName: string | null
  quantity: string | null
  unit: string | null
  meterOpening: string | null
  meterClosing: string | null
  meterId: string | null
  labName: string | null
  testResult: string | null
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

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

const EXTRACTION_PROMPT = `You are an expert data-extraction engine for an industrial ESG reporting platform.
Extract the following fields from this utility invoice / meter reading / lab report / delivery document image or PDF.

Rules:
- Read ONLY what is actually visible in the document. If a field is not present, return null for it.
- Numbers: digits only, no thousand separators. Keep units exactly as written (kWh, kL, litres, MT, m³...).
- dates: ISO format (YYYY-MM-DD) when a date is visible.
- confidence: "high" if the document is a clear bill/meter/log with the quantity readable, "medium" if partially legible, "low" otherwise.
Return a single JSON object with exactly these keys:
docType (one of INVOICE | METER_READING | LAB_REPORT | DELIVERY_CHALLAN | REGISTER | OTHER),
invoiceNo, date, sourceName (the utility/fuel/material name, e.g. "Grid Electricity", "Diesel (HSD)", "Groundwater"),
quantity, unit, meterOpening, meterClosing, meterId, labName, testResult, notes (one short sentence of context), confidence.`

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

export async function runGeminiOcr(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  if (!isGeminiConfigured()) {
    return { ok: false, keyMissing: true, error: 'GEMINI_API_KEY is not configured on the server.' }
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return { ok: false, error: 'File too large for AI scanning (max 10 MB).' }
  }

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
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini API error (${res.status})`
      return { ok: false, error: msg }
    }
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('') ?? ''
    if (!text) return { ok: false, error: 'Gemini returned no content for this document.' }

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) return { ok: false, error: 'Could not parse the extraction result.', rawText: text.slice(0, 500) }
      parsed = JSON.parse(m[0])
    }

    const allowed = new Set(['INVOICE', 'METER_READING', 'LAB_REPORT', 'DELIVERY_CHALLAN', 'REGISTER', 'OTHER'])
    const conf = ['high', 'medium', 'low'].includes(parsed?.confidence) ? parsed.confidence : 'low'
    const fields: OcrFields = {
      docType: allowed.has(parsed?.docType) ? parsed.docType : parsed?.docType ? 'OTHER' : null,
      invoiceNo: parsed?.invoiceNo ?? null,
      date: parsed?.date ?? null,
      sourceName: parsed?.sourceName ?? null,
      quantity: parsed?.quantity != null ? String(parsed.quantity) : null,
      unit: parsed?.unit ?? null,
      meterOpening: parsed?.meterOpening != null ? String(parsed.meterOpening) : null,
      meterClosing: parsed?.meterClosing != null ? String(parsed.meterClosing) : null,
      meterId: parsed?.meterId ?? null,
      labName: parsed?.labName ?? null,
      testResult: parsed?.testResult ?? null,
      notes: parsed?.notes ?? null,
      confidence: conf,
    }
    return { ok: true, fields }
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' ? 'AI scan timed out — try a smaller/clearer file.' : e?.message || 'AI scan failed'
    return { ok: false, error: msg }
  }
}
