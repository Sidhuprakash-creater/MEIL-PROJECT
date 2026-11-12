/* Wipe: every REPORT and every EVIDENCE (and the reporting trail that
   hangs off them). Master data — subsidiaries, business units, projects,
   users, roles, reporting periods, disclosure catalog — is untouched so the
   platform stays usable and the team stays logged in.

   Run: npx tsx scripts/wipe-reports-evidence.ts */
import { db } from "../src/lib/db";
import {
  ensureLevelRecordsLoaded, getLevelRecords, deleteLevelRecord,
} from "../src/lib/pu/level-records";

async function main() {
  console.log("── wiping reports & evidence ──");

  /* 1. Evidence — the vault rows, their documents and the uploaded files. */
  const evidenceCount = await db.evidence.count();
  const evidenceDocCount = await db.evidenceDoc.count();
  await db.evidence.deleteMany({});
  await db.evidenceDoc.deleteMany({});
  console.log(`  ✓ evidence deleted — ${evidenceCount} vault rows, ${evidenceDocCount} documents`);

  /* 2. Reports — group BRSR reports, subsidiary BRSR data forms, reporting
        packages and every consolidated/final report row. */
  const brsrReports = await db.brsrReport.count();
  const brsrData = await db.brsrSubsidiaryData.count();
  const packages = await db.reportingPackage.count();
  const reports = await db.report.count();
  await db.brsrReport.deleteMany({});
  await db.brsrSubsidiaryData.deleteMany({});
  await db.reportingPackage.deleteMany({});
  await db.report.deleteMany({});
  console.log(`  ✓ reports deleted — ${brsrReports} BRSR reports, ${brsrData} subsidiary data forms, ${packages} packages, ${reports} report rows`);

  /* 3. Submissions — the disclosures themselves (they carry the evidence
        references and the review trail). */
  const submissions = await db.submission.count();
  await db.submission.deleteMany({});
  console.log(`  ✓ submissions deleted — ${submissions}`);

  /* 4. Source records (energy / water / waste …) and their findings. */
  const energy = await db.energyRecord.count();
  const water = await db.waterRecord.count();
  const waste = await db.wasteRecord.count();
  const workforce = await db.workforceRecord.count();
  const safety = await db.safetyRecord.count();
  const travel = await db.travelRecord.count();
  await db.energyRecord.deleteMany({});
  await db.waterRecord.deleteMany({});
  await db.wasteRecord.deleteMany({});
  await db.workforceRecord.deleteMany({});
  await db.safetyRecord.deleteMany({});
  await db.travelRecord.deleteMany({});
  console.log(`  ✓ source records deleted — energy ${energy}, water ${water}, waste ${waste}, workforce ${workforce}, safety ${safety}, travel ${travel}`);

  /* 5. Validation findings & anomalies. */
  const issues = await db.validationIssue.count();
  const anomalies = await db.anomalyEvent.count();
  await db.validationIssue.deleteMany({});
  await db.anomalyEvent.deleteMany({});
  console.log(`  ✓ findings deleted — ${issues} validation issues, ${anomalies} anomalies`);

  /* 6. The level-record store — the site data-entry records themselves. */
  await ensureLevelRecordsLoaded().catch(() => {});
  const records = getLevelRecords();
  for (const r of records) deleteLevelRecord(r.id);
  console.log(`  ✓ level-record store cleared — ${records.length} site data records`);

  /* 7. The trail — notifications, activity feed and the audit log. */
  const notifs = await db.notification.count();
  const activity = await db.activityEvent.count();
  const audit = await db.auditEvent.count();
  await db.notification.deleteMany({});
  await db.activityEvent.deleteMany({});
  await db.auditEvent.deleteMany({});
  console.log(`  ✓ trail cleared — ${notifs} notifications, ${activity} activity, ${audit} audit`);

  console.log("\n── remaining ──");
  const after = await Promise.all([
    db.submission.count(),
    db.evidence.count(),
    db.evidenceDoc.count(),
    db.reportingPackage.count(),
    db.brsrReport.count(),
    db.brsrSubsidiaryData.count(),
    db.report.count(),
    db.subsidiary.count(),
    db.project.count(),
    db.user.count(),
  ]);
  const labels = [
    "submissions", "evidence", "evidenceDoc", "packages", "brsrReports",
    "brsrSubsidiaryData", "reports", "SUBSIDIARIES (kept)", "PROJECTS (kept)", "USERS (kept)",
  ];
  after.forEach((c, i) => console.log(`  ${labels[i].padEnd(24)} ${c}`));

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
