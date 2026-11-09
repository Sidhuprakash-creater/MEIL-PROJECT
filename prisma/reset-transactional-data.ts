// One-off cleanup: delete all transactional data (submissions, reports, records,
// activity, notifications, messages, tasks, evidence, validation, etc.).
// Keeps: Subsidiary, BusinessUnit, Project, User, AppSetting, ReportingYear,
// ReportingPeriod, UnitMaster, ConversionRule, EmissionFactor,
// BrsrFramework/Section/Principle/Question, ValidationRule.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deletions: [string, () => Promise<unknown>][] = [
    ["SubmissionStatusHistory", () => prisma.submissionStatusHistory.deleteMany({})],
    ["CorrectionRequest", () => prisma.correctionRequest.deleteMany({})],
    ["SoSubmission", () => prisma.soSubmission.deleteMany({})],
    ["SoAuditLog", () => prisma.soAuditLog.deleteMany({})],
    ["SoNotification", () => prisma.soNotification.deleteMany({})],
    ["ValidationIssue", () => prisma.validationIssue.deleteMany({})],
    ["ValidationResult", () => prisma.validationResult.deleteMany({})],
    ["AnomalyEvent", () => prisma.anomalyEvent.deleteMany({})],
    ["CalculationResult", () => prisma.calculationResult.deleteMany({})],
    ["EvidenceDoc", () => prisma.evidenceDoc.deleteMany({})],
    ["Evidence", () => prisma.evidence.deleteMany({})],
    ["ReportingPackage", () => prisma.reportingPackage.deleteMany({})],
    ["ReportingTimeline", () => prisma.reportingTimeline.deleteMany({})],
    ["BrsrAnswer", () => prisma.brsrAnswer.deleteMany({})],
    ["BrsrReport", () => prisma.brsrReport.deleteMany({})],
    ["Disclosure", () => prisma.disclosure.deleteMany({})],
    ["Report", () => prisma.report.deleteMany({})],
    ["ActivityEvent", () => prisma.activityEvent.deleteMany({})],
    ["AuditEvent", () => prisma.auditEvent.deleteMany({})],
    ["AuditLog", () => prisma.auditLog.deleteMany({})],
    ["Activity", () => prisma.activity.deleteMany({})],
    ["Message", () => prisma.message.deleteMany({})],
    ["Notification", () => prisma.notification.deleteMany({})],
    ["Task", () => prisma.task.deleteMany({})],
    ["Session", () => prisma.session.deleteMany({})],
    ["Submission", () => prisma.submission.deleteMany({})],
    // Period records
    ["EnergyRecord", () => prisma.energyRecord.deleteMany({})],
    ["WaterRecord", () => prisma.waterRecord.deleteMany({})],
    ["WasteRecord", () => prisma.wasteRecord.deleteMany({})],
    ["WorkforceRecord", () => prisma.workforceRecord.deleteMany({})],
    ["SafetyRecord", () => prisma.safetyRecord.deleteMany({})],
    ["TravelRecord", () => prisma.travelRecord.deleteMany({})],
  ];

  for (const [name, fn] of deletions) {
    try {
      const r = await fn();
      console.log(`✓ ${name}: deleted ${(r as { count: number }).count}`);
    } catch (e: any) {
      console.log(`✗ ${name}: ${e.message.split("\n")[0]}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
