import { PrismaClient } from '@prisma/client'

// Global type definition to preserve client across hot-reloads in Next.js development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

/**
 * Health check & diagnostic interface for Database Connection
 */
export interface DbHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  provider: 'postgresql' | 'sqlite' | 'unknown'
  latencyMs: number
  timestamp: string
  details?: {
    usersCount?: number
    subsidiariesCount?: number
    projectsCount?: number
    poolerMode?: string
  }
  error?: string
}

/**
 * Verify live connection to database and calculate latency
 */
export async function checkDatabaseHealth(): Promise<DbHealthResult> {
  const start = performance.now()
  try {
    // Quick query to test connection & measuring round-trip time
    const [usersCount, subsidiariesCount, projectsCount] = await Promise.all([
      db.user.count(),
      db.subsidiary.count(),
      db.project.count(),
    ])

    const latencyMs = Math.round(performance.now() - start)
    const dbUrl = process.env.DATABASE_URL || ''
    const isPostgres = dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgres:')

    return {
      status: 'healthy',
      provider: isPostgres ? 'postgresql' : dbUrl.startsWith('file:') ? 'sqlite' : 'unknown',
      latencyMs,
      timestamp: new Date().toISOString(),
      details: {
        usersCount,
        subsidiariesCount,
        projectsCount,
        poolerMode: dbUrl.includes('pgbouncer=true') ? 'PgBouncer (Transaction Pooler)' : 'Direct',
      },
    }
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return {
      status: 'unhealthy',
      provider: 'unknown',
      latencyMs,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    }
  }
}
