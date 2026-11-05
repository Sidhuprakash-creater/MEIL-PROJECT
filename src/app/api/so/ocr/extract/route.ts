import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/so/session'
import { runGeminiOcr } from '@/lib/ai/gemini'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
])

/** POST /api/so/ocr/extract — AI scan of an evidence document (multipart file). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Provide a file field' }, { status: 400 })
    }
    const mimeType = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json({ error: 'Only PNG / JPEG / WEBP / HEIC / PDF can be scanned' }, { status: 415 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await runGeminiOcr(buffer, mimeType)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, keyMissing: result.keyMissing ?? false },
        { status: result.keyMissing ? 501 : 502 },
      )
    }
    return NextResponse.json({ fields: result.fields })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI scan failed' }, { status: 500 })
  }
}
