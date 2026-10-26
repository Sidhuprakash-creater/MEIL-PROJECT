# Migrating to Supabase + PostgreSQL

The platform is Prisma-first: **every** read/write goes through Prisma Client —
there is no raw SQL, no SQLite-specific pragma, and both databases (main
platform + Project User Portal) share the same modeling contract. Moving to
Supabase PostgreSQL is a connection-string + generator switch, not a rewrite.

## 1. What is already Postgres-ready

| Piece | File | Notes |
|---|---|---|
| Main schema (Postgres variant) | `prisma/schema.postgres.prisma` | `provider = "postgresql"`, identical models |
| Portal schema (Postgres variant) | `prisma/pu-schema.postgres.prisma` | same, for the site-operations portal |
| Bridge (`src/lib/bridge/pu-link.ts`) | both clients | provider-agnostic |
| JSON payload columns | serialized `String` | valid on both engines; optionally migrate to `Json` later |

## 2. Steps

1. **Create the Supabase project**, copy the connection string
   (Project Settings → Database → Connection string → "Pooler", port `6543`
   for app traffic, `5432` direct for migrations).

2. **Set environment variables** (`.env`):

   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
   DIRECT_URL="postgresql://postgres.<ref>:<pwd>@aws-0-<region>.supabase.com:5432/postgres"
   PU_DATABASE_URL="<same pattern, separate schema or database, e.g. /postgres?schema=portal>"
   SESSION_SECRET="<long random string>"
   ```

3. **Generate + push** with the Postgres variants:

   ```bash
   bun run db:generate:pg && bun run db:push:pg
   bun run db:generate:pu:pg && bun run db:push:pu:pg
   ```

4. **Seed** (the seeders are provider-agnostic — regenerate the client from
   the Postgres schema first, then run them unchanged):

   ```bash
   bun prisma/seed.ts && bun prisma/seed-auth.ts
   bun prisma/seed-pu.ts
   ```

5. **Restart** `bun run dev`. Nothing in `src/` changes.

## 3. Notes & gotchas

- **Two clients, one process**: the app intentionally runs two Prisma clients
  (`@prisma/client` and `src/generated/pu`). After switching both schemas to
  Postgres, regenerate both. Keep `PU_DATABASE_URL` on a separate database (or
  a dedicated Postgres schema) so portal data stays isolated.
- **Pooling**: use the Supabase pooler URL (`:6543`, `pgbouncer=true`) as
  `DATABASE_URL` for the running app; use the direct URL for `db push`.
- **Evidence files**: uploads currently live in `public/evidence-uploads/`
  (real files with SHA-256 hashes). On Supabase, move the directory to
  **Supabase Storage** and keep the `EvidenceDoc.fileUrl` /
  `Evidence.filePath` columns pointing at the storage URLs — no schema change
  is needed, only the writer in `src/app/api/pu/evidence/route.ts`.
- **Sessions**: both auth systems store opaque tokens server-side; nothing
  engine-specific.

## 4. Post-cutover verification checklist

1. Gateway login for every role (Group / Subsidiary Admin / Subsidiary Manager / portal users).
2. Portal data-entry submit → `PU-*` row appears in the Subsidiary Manager queue.
3. Subsidiary Manager approve/reject → portal submitter notified + status advanced.
4. Group Admin approve → portal status `APPROVED`, attribution correct.
5. Task assigned by Group Admin → portal users receive the deadline notification.
6. Evidence upload in the portal → visible + downloadable in the Subsidiary console.
