# Migrating the MEIL ESG Platform to Supabase PostgreSQL

The application is **engine-agnostic by design**:

- **Zero raw SQL** — every query goes through the Prisma Client, so SQLite →
  PostgreSQL needs no application-code changes.
- **No SQLite-specific Prisma features** — no `Json` columns (JSON is stored in
  `String` columns and parsed in the API layer), no enums (roles/statuses are
  plain `String`s), which keeps the identical schema valid on both engines.
- **Binary evidence files** are stored with the Prisma `Bytes` type — SQLite
  `BLOB` today, PostgreSQL `bytea` on Supabase tomorrow — through
  `src/lib/uploads.ts`. If you later prefer Supabase Storage (S3-backed URLs,
  CDN), only `src/lib/uploads.ts` changes; no console/API code is affected.

Everything below has been prepared in the repo:

| Artifact | Purpose |
|---|---|
| `prisma/schema.postgres.prisma` | PostgreSQL datasource variant of the schema (byte-identical models) |
| `prisma/seed.ts`, `prisma/seed-auth.ts`, `prisma/seed-sa.ts`, `prisma/seed-bu.ts` | Engine-agnostic seeds (run order documented in `seed.ts` header) |

## 1. Create the Supabase project

1. Create a project at supabase.com (pick the region closest to your users).
2. Open **Project Settings → Database → Connection string**. You need TWO strings:
   - **Direct connection** (port `5432`) — used for schema push/migrate only:
     ```
     postgresql://postgres:<PASSWORD>@db.<PROJECT-REF>.supabase.co:5432/postgres
     ```
   - **Connection pooler** (port `6543`, PgBouncer) — used by the app at runtime:
     ```
     postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
     ```

## 2. Point the app at Postgres

Create/edit `.env`:

```bash
# Runtime (PgBouncer pooler — serverless-safe)
DATABASE_URL="postgresql://postgres.<REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"

# Migrations / db push (direct, no pooler)
DIRECT_URL="postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres"
```

> Keep the old SQLite `file:...` URL commented out so you can switch back for
> local offline development.

## 3. Push the schema

```bash
npx prisma db push --schema prisma/schema.postgres.prisma --skip-generate
npx prisma generate --schema prisma/schema.postgres.prisma
```

(Prefer `prisma migrate dev` for a history you can replay — `db push` is the
fastest path for a fresh project; both work with this schema.)

## 4. Seed demo data (optional but recommended)

```bash
bun prisma/seed.ts          # org structure + console demo data  (wipes users)
bun prisma/seed-auth.ts     # portal credentials — ALWAYS run after seed.ts
bun prisma/seed-sa.ts       # subsidiary workspace data
bun prisma/seed-bu.ts       # BU workspace data
```

All seeds use plain Prisma calls — they run unchanged on Postgres.

## 5. Run

```bash
bun run dev
```

Nothing else changes: sessions, notifications, submissions, tasks, evidence
uploads/downloads and every cross-console flow read/write through Prisma with
the same code paths.

## Supabase hardening checklist (production)

- [ ] **Row Level Security**: the app connects with the service role and does
      its own scoping in the API layer (BU/subsidiary guards). If you ever
      expose tables to the Supabase JS client directly, enable RLS first.
- [ ] **Network**: restrict the direct (5432) port to your migration host;
      the app only needs the 6543 pooler.
- [ ] **Evidence at scale**: once evidence files grow past a few hundred MB,
      move bytes to Supabase Storage — edit `src/lib/uploads.ts`
      (`storeEvidenceFile` writes the blob, `serveEvidenceBytes` streams it)
      and keep `EvidenceFile.data` as the fallback path.
- [ ] **Backups**: Supabase PITR covers the DB including evidence bytes.
- [ ] **SSL**: Supabase enforces TLS; no extra Prisma flags needed
      (`sslmode=require` is included in their connection strings).

## Switching back to local SQLite

```bash
# .env: DATABASE_URL="file:../db/custom.db"
npx prisma db push && bun prisma/seed.ts && bun prisma/seed-auth.ts
```

(The app detects nothing — Prisma reads the provider from the schema you
generate against. For daily development keep
`npx prisma generate --schema prisma/schema.prisma` so the generated client
matches SQLite.)
