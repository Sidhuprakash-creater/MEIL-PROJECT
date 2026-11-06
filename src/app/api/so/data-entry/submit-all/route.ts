import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/* POST /api/so/data-entry/submit-all — Submit-All for the site-ops portal.
   The shared DataEntryModule (mounted with apiBase="/api/so") posts its full
   allData payload here. Each non-empty level is delegated to the existing
   single-level POST handler in ../route.ts (which runs the per-level
   validation, saves the LevelRecord, creates the soSubmission row AND mirrors
   into the unified db.submission ledger the Project Admin reads). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const allData: Record<string, Record<string, any>> = body?.allData || {}
    const { POST: postSingleLevel } = await import('../route')

    const results: Array<{ key: string; ok: boolean; level?: unknown; error?: string }> = []
    for (const [key, payload] of Object.entries(allData)) {
      if (!payload || typeof payload !== 'object') continue
      // Skip scopes the user never filled (no items, no meaningful scalar data).
      const hasItems = Array.isArray((payload as any).items) && (payload as any).items.length > 0
      const hasScalar = Object.entries(payload as Record<string, unknown>).some(
        ([k, v]) =>
          k !== 'items' &&
          k !== 'viewStep' &&
          typeof v === 'string' && v.trim() !== ''
      )
      const hasNumbers = Object.entries(payload as Record<string, unknown>).some(
        ([k, v]) => k !== 'items' && typeof v === 'number' && v > 0
      )
      if (!hasItems && !hasScalar && !hasNumbers) continue

      try {
        const inner = new NextRequest(new URL('/api/so/data-entry', req.url), {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify(payload),
        })
        const res = await postSingleLevel(inner)
        const j = await res.json().catch(() => ({}))
        results.push({ key, ok: res.ok, level: j?.record?.level, error: res.ok ? undefined : j?.error })
      } catch (e: any) {
        results.push({ key, ok: false, error: e?.message || 'level failed' })
      }
    }

    const okCount = results.filter((r) => r.ok).length
    return NextResponse.json(
      {
        ok: okCount > 0,
        submitted: okCount,
        total: results.length,
        results,
        error: okCount === 0 ? 'No levels could be submitted — check the payloads.' : undefined,
      },
      { status: okCount > 0 ? 200 : 400 },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Submit-all failed' }, { status: 500 })
  }
}
