import { NextResponse } from 'next/server'
import { checkDatabaseHealth } from '@/lib/db'

export async function GET() {
  const result = await checkDatabaseHealth()

  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503

  return NextResponse.json(result, { status: statusCode })
}
