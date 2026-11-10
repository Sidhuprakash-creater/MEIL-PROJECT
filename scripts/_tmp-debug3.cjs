const { Client } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const subs = await c.query('select ref, title, "submittedAt", "recordIds", evidence, "evidenceCount" from "Submission" order by "submittedAt" desc nulls last limit 8');
  for (const s of subs.rows) {
    console.log('SUB', s.submittedAt?.toISOString?.() || s.submittedAt, '|', s.ref, '| count:', s.evidenceCount, '| evidence:', (s.evidence || '').slice(0, 80), '| recordIds:', (s.recordIds || '').slice(0, 80));
  }
  const blob = await c.query("select svalue, \"updatedAt\" from \"AppSetting\" where skey = 'level_records_blob'");
  if (blob.rows.length) {
    const recs = JSON.parse(Buffer.from(blob.rows[0].svalue, 'base64').toString('utf-8'));
    console.log('BLOB updatedAt:', blob.rows[0].updatedAt?.toISOString?.() || blob.rows[0].updatedAt, '| records:', recs.length);
    for (const r of recs) console.log(' *', r.id, '| lvl', r.level, '|', r.module, '| evidenceIds:', JSON.stringify(r.evidenceIds || r.evidenceId || []));
  } else console.log('NO BLOB');
  const ev = await c.query('select id, "fileName", "createdAt" from "Evidence" order by "createdAt" desc limit 5');
  for (const e of ev.rows) console.log('EVIDENCE', e.createdAt?.toISOString?.() || e.createdAt, '|', e.id, '|', e.fileName);
  await c.end();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
