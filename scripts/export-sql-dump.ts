import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function formatSqlValue(val: any): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'number') {
    return isFinite(val) ? val.toString() : 'NULL';
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (Buffer.isBuffer(val)) {
    return `decode('${val.toString('hex')}', 'hex')`;
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'`;
  }
  // String escape
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

async function runDump() {
  console.log('--- Generating PostgreSQL DDL Schema ---');
  let ddl = '';
  try {
    ddl = execSync(
      'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    console.error('Failed to generate DDL via prisma:', err);
    process.exit(1);
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DIRECT_URL or DATABASE_URL found in .env');
    process.exit(1);
  }

  console.log('--- Connecting to Supabase Database ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL successfully.');

  // Fetch all base tables in public schema
  const tablesRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '_prisma%'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map((r) => r.table_name);
  console.log(`Found ${tables.length} tables to dump.`);

  const dumpFilePath = path.join(process.cwd(), 'meil_esg_database_dump.sql');
  const outStream = fs.createWriteStream(dumpFilePath, { encoding: 'utf-8' });

  // Write Dump Header
  outStream.write(`-- ==========================================================\n`);
  outStream.write(`-- MEIL ESG & BRSR Platform — Complete PostgreSQL SQL Dump\n`);
  outStream.write(`-- Target Engine: PostgreSQL (Supabase / AWS / Local Postgres)\n`);
  outStream.write(`-- Generated: ${new Date().toISOString()}\n`);
  outStream.write(`-- Tables: ${tables.length}\n`);
  outStream.write(`-- ==========================================================\n\n`);

  outStream.write(`-- 1. Schema Definition (DDL)\n`);
  outStream.write(ddl);
  outStream.write(`\n\n-- ==========================================================\n`);
  outStream.write(`-- 2. Data Inserts\n`);
  outStream.write(`-- ==========================================================\n\n`);
  outStream.write(`SET statement_timeout = 0;\n`);
  outStream.write(`SET lock_timeout = 0;\n`);
  outStream.write(`SET client_encoding = 'UTF8';\n`);
  outStream.write(`SET standard_conforming_strings = on;\n`);
  outStream.write(`SET check_function_bodies = false;\n`);
  outStream.write(`SET xmloption = content;\n`);
  outStream.write(`SET client_min_messages = warning;\n`);
  outStream.write(`SET row_security = off;\n\n`);
  outStream.write(`-- Disable foreign key checks during data load\n`);
  outStream.write(`SET session_replication_role = 'replica';\n\n`);

  let totalRecords = 0;

  for (const tableName of tables) {
    // Check if table exists in public schema
    const rowsRes = await client.query(`SELECT * FROM "public"."${tableName}";`);
    const rows = rowsRes.rows;
    console.log(`Table "${tableName}": ${rows.length} rows`);

    if (rows.length === 0) {
      outStream.write(`-- Table "public"."${tableName}" (0 rows)\n\n`);
      continue;
    }

    totalRecords += rows.length;
    outStream.write(`-- Table "public"."${tableName}" (${rows.length} rows)\n`);

    // Column names
    const columns = Object.keys(rows[0]);
    const quotedColumns = columns.map((col) => `"${col}"`).join(', ');

    // Chunk inserts into batches of 50
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valuesList = chunk
        .map((row) => {
          const vals = columns.map((col) => formatSqlValue(row[col]));
          return `  (${vals.join(', ')})`;
        })
        .join(',\n');

      outStream.write(
        `INSERT INTO "public"."${tableName}" (${quotedColumns}) VALUES\n${valuesList};\n`
      );
    }
    outStream.write('\n');
  }

  outStream.write(`-- Re-enable foreign key checks\n`);
  outStream.write(`SET session_replication_role = 'origin';\n\n`);
  outStream.write(`-- End of Dump (${totalRecords} total records)\n`);

  await new Promise((resolve) => outStream.end(resolve));
  await client.end();

  const stats = fs.statSync(dumpFilePath);
  console.log(`\nSQL dump completed successfully!`);
  console.log(`File created: ${dumpFilePath}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB (${totalRecords} records across ${tables.length} tables)`);
}

runDump().catch((err) => {
  console.error('Error generating dump:', err);
  process.exit(1);
});
