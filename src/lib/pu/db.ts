import { db as mainDb } from '@/lib/db'

/**
 * Project User Portal — database access.
 * The portal now shares the platform's single unified Prisma client and
 * database (same User / Project / Submission / Evidence tables the other
 * consoles use), so data submitted here reflects seamlessly to Group,
 * Subsidiary, BU consoles and site-operations — one ledger, one truth.
 */
export const db = mainDb
