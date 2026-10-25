/**
 * grant-esg-permissions.ts — idempotent RBAC grant for existing databases.
 *
 * Fixes the RBAC gap where the Phase-1 data-entry roles (FINANCE_USER, HR_USER,
 * EHS_USER, PROCUREMENT_USER, CSR_USER, COMPLIANCE_USER) held ZERO permissions,
 * which caused 403 Forbidden on every requirePermission() call (e.g. EHS users
 * could not save safety records, HR users could not save workforce records).
 *
 * Mirrors the rolePermMap in prisma/seed.ts. Safe to re-run — uses upserts.
 *
 * Usage:
 *   bun run prisma/../scripts/grant-esg-permissions.ts
 *   npx tsx scripts/grant-esg-permissions.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Keep in sync with prisma/seed.ts rolePermMap.
const GRANTS: Record<string, string[]> = {
  FINANCE_USER: ['organization.read', 'project.read', 'esg.travel.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
  HR_USER: ['organization.read', 'project.read', 'esg.people.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
  EHS_USER: ['organization.read', 'project.read', 'esg.safety.write', 'esg.energy.write', 'esg.water.write', 'esg.waste.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
  PROCUREMENT_USER: ['organization.read', 'project.read', 'esg.travel.write', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
  CSR_USER: ['organization.read', 'project.read', 'evidence.upload', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
  COMPLIANCE_USER: ['organization.read', 'project.read', 'evidence.read', 'submission.submit', 'brsr.read', 'report.read', 'audit.read'],
}

async function main() {
  console.log('🔐 Granting ESG module permissions to data-entry roles...')
  let granted = 0
  let skipped = 0

  for (const [roleKey, permKeys] of Object.entries(GRANTS)) {
    const role = await db.role.findUnique({ where: { key: roleKey } })
    if (!role) {
      console.log(`  ⚠ Role '${roleKey}' not found in DB — skipping (re-run prisma/seed.ts to create it)`)
      skipped++
      continue
    }
    for (const permKey of permKeys) {
      const perm = await db.permission.findUnique({ where: { key: permKey } })
      if (!perm) {
        console.log(`  ⚠ Permission '${permKey}' not found — skipping`)
        skipped++
        continue
      }
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      })
      granted++
    }
    console.log(`  ✓ ${roleKey}: ${permKeys.length} permissions ensured`)
  }

  console.log(`✅ Done. ${granted} role-permission links ensured, ${skipped} skipped.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
