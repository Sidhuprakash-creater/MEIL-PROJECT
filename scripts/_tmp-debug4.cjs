const { Client } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const subs = await c.query('select ref, title, "recordIds" from "Submission" order by "submittedAt" desc limit 3');
  for (const s of subs.rows) console.log('SUB', s.ref, '|', (s.title || '').slice(0, 50), '| recordIds:', s.recordIds);
  const ev = await c.query('select id, "fileName", "filePath", "projectId" from "Evidence" order by "createdAt" desc limit 6');
  for (const e of ev.rows) console.log('EV', e.id, '|', e.fileName, '|', e.filePath, '| proj', e.projectId);
  const blobs = await c.query("select skey from \"AppSetting\" where category = 'EVIDENCE_BLOB'");
  console.log('blobs:', blobs.rows.map(r => r.skey).join(', '));
  await c.end();
})().catch(e => console.error(e.message));
