-- ==========================================================
-- MEIL ESG & BRSR Platform — Complete PostgreSQL SQL Dump
-- Target Engine: PostgreSQL (Supabase / AWS / Local Postgres)
-- Tables: 47
-- ==========================================================

-- 1. Schema Definition (DDL)
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Subsidiary" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL DEFAULT 'Energy',
    "region" TEXT NOT NULL DEFAULT 'India',
    "city" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "managerName" TEXT NOT NULL DEFAULT '',
    "adminName" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subsidiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "managerName" TEXT NOT NULL DEFAULT '',
    "adminName" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "ptype" TEXT NOT NULL DEFAULT 'SITE',
    "capacityMw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employeeId" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subsidiaryId" TEXT,
    "businessUnitId" TEXT,
    "projectId" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" TEXT,
    "portal" TEXT,
    "role" TEXT,
    "scopeRef" TEXT,
    "reason" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metricName" TEXT NOT NULL DEFAULT '',
    "metricValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metricUnit" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "overdue" BOOLEAN NOT NULL DEFAULT false,
    "period" TEXT NOT NULL DEFAULT 'FY 2025-26',
    "fiscalQuarter" TEXT NOT NULL DEFAULT 'Q1',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "subsidiaryId" TEXT,
    "businessUnitId" TEXT,
    "projectId" TEXT,
    "submittedById" TEXT,
    "reviewerId" TEXT,
    "values" TEXT NOT NULL DEFAULT '[]',
    "evidence" TEXT NOT NULL DEFAULT '[]',
    "comments" TEXT NOT NULL DEFAULT '[]',
    "history" TEXT NOT NULL DEFAULT '[]',
    "module" TEXT,
    "recordIds" TEXT,
    "reportingPeriodId" TEXT,
    "completionPct" DOUBLE PRECISION,
    "evidenceCount" INTEGER,
    "validationPassed" INTEGER,
    "validationErrors" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "reviewComment" TEXT,
    "corrections" TEXT DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'ENVIRONMENT',
    "assigneeType" TEXT NOT NULL DEFAULT 'USER',
    "assigneeLabel" TEXT NOT NULL DEFAULT '',
    "assigneeFilter" TEXT NOT NULL DEFAULT '{}',
    "subsidiaryId" TEXT,
    "businessUnitId" TEXT,
    "period" TEXT NOT NULL DEFAULT 'FY 2025-26',
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT true,
    "recipients" INTEGER NOT NULL DEFAULT 1,
    "acknowledged" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "reminderLog" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "ntype" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "linkView" TEXT NOT NULL DEFAULT 'dashboard',
    "refId" TEXT NOT NULL DEFAULT '',
    "subsidiaryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
    "channel" TEXT NOT NULL DEFAULT 'GROUP_WIDE',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceLabel" TEXT NOT NULL DEFAULT '',
    "audienceFilter" TEXT NOT NULL DEFAULT '{}',
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "scheduledFor" TIMESTAMP(3),
    "sentBy" TEXT NOT NULL DEFAULT 'Group Admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrsrReport" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL DEFAULT 'FY 2025-26',
    "framework" TEXT NOT NULL DEFAULT 'SEBI BRSR Core v1.0',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "ownerName" TEXT NOT NULL DEFAULT 'Group Admin',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "wizardStep" INTEGER NOT NULL DEFAULT 1,
    "scope" TEXT NOT NULL DEFAULT '{}',
    "sections" TEXT NOT NULL DEFAULT '[]',
    "disclosures" TEXT NOT NULL DEFAULT '[]',
    "signoffs" TEXT NOT NULL DEFAULT '[]',
    "exports" TEXT NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "versions" TEXT NOT NULL DEFAULT '[]',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrsrReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disclosure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "unit" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetLabel" TEXT NOT NULL DEFAULT '',
    "orgLabel" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "targetLabel" TEXT NOT NULL DEFAULT '',
    "orgScope" TEXT NOT NULL DEFAULT 'GROUP',
    "before" TEXT NOT NULL DEFAULT '{}',
    "after" TEXT NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "correlation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingTimeline" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'FY 2025-26',
    "level" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "projectId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "reviewDeadline" TIMESTAMP(3),
    "categories" TEXT NOT NULL DEFAULT '[]',
    "inheritanceMode" TEXT NOT NULL DEFAULT 'INHERIT',
    "overrideReason" TEXT NOT NULL DEFAULT '',
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingPackage" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "subsidiaryName" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT 'FY 2025-26',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "readinessPct" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL DEFAULT '{}',
    "sourceRefs" TEXT NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT NOT NULL DEFAULT '',
    "groupFeedback" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "rule" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "projectId" TEXT,
    "submissionId" TEXT,
    "submissionRef" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT 'FY 2025-26',
    "responsibleName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "resolveNote" TEXT NOT NULL DEFAULT '',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceDoc" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'PDF',
    "sizeKb" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "subsidiaryId" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "projectId" TEXT,
    "submissionId" TEXT,
    "submissionRef" TEXT NOT NULL DEFAULT '',
    "disclosureRef" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "skey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "svalue" TEXT NOT NULL DEFAULT '{}',
    "vtype" TEXT NOT NULL DEFAULT 'toggle',
    "options" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingYear" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL DEFAULT 'MEIL-GROUP',
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingPeriod" (
    "id" TEXT NOT NULL,
    "reportingYearId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "quarter" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "submissionDeadline" TIMESTAMP(3),
    "reviewDeadline" TIMESTAMP(3),
    "approvalDeadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitMaster" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "baseUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionRule" (
    "id" TEXT NOT NULL,
    "fromUnit" TEXT NOT NULL,
    "toUnit" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmissionFactor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fuelType" TEXT,
    "geography" TEXT NOT NULL DEFAULT 'IN',
    "factorValue" DOUBLE PRECISION NOT NULL,
    "factorUnit" TEXT NOT NULL,
    "ch4Factor" DOUBLE PRECISION,
    "n2oFactor" DOUBLE PRECISION,
    "scope" TEXT NOT NULL DEFAULT 'SCOPE_1',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "methodology" TEXT,
    "sourceDocument" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmissionFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'ENERGY',
    "source" TEXT NOT NULL,
    "sourceCategory" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "sourceUnit" TEXT NOT NULL,
    "normalizedValue" DOUBLE PRECISION,
    "normalizedUnit" TEXT,
    "vendor" TEXT,
    "meterRef" TEXT,
    "evidenceId" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "calculationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "enteredBy" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "EnergyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'WATER',
    "source" TEXT NOT NULL,
    "withdrawal" DOUBLE PRECISION NOT NULL,
    "consumption" DOUBLE PRECISION,
    "discharge" DOUBLE PRECISION,
    "recycledReused" DOUBLE PRECISION,
    "treatment" TEXT,
    "destination" TEXT,
    "sourceUnit" TEXT NOT NULL,
    "waterStress" BOOLEAN NOT NULL DEFAULT false,
    "zldActive" BOOLEAN NOT NULL DEFAULT false,
    "evidenceId" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "calculationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "enteredBy" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "WaterRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'WASTE',
    "wasteType" TEXT NOT NULL,
    "hazardous" BOOLEAN NOT NULL DEFAULT false,
    "generatedQty" DOUBLE PRECISION NOT NULL,
    "recoveredQty" DOUBLE PRECISION,
    "recycledQty" DOUBLE PRECISION,
    "reusedQty" DOUBLE PRECISION,
    "disposedQty" DOUBLE PRECISION,
    "disposalRoute" TEXT,
    "vendor" TEXT,
    "manifestRef" TEXT,
    "sourceUnit" TEXT NOT NULL,
    "evidenceId" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "calculationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "enteredBy" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "WasteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'PEOPLE',
    "category" TEXT NOT NULL,
    "permanent" INTEGER NOT NULL,
    "nonPermanent" INTEGER NOT NULL,
    "male" INTEGER NOT NULL,
    "female" INTEGER NOT NULL,
    "other" INTEGER,
    "differentlyAbled" INTEGER,
    "newHires" INTEGER,
    "exits" INTEGER,
    "trainingHours" DOUBLE PRECISION,
    "evidenceId" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "enteredBy" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "WorkforceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'SAFETY',
    "recordType" TEXT NOT NULL,
    "fatalities" INTEGER NOT NULL DEFAULT 0,
    "injuries" INTEGER NOT NULL DEFAULT 0,
    "lostTimeIncidents" INTEGER NOT NULL DEFAULT 0,
    "recordableInjuries" INTEGER NOT NULL DEFAULT 0,
    "highConsequenceIncidents" INTEGER NOT NULL DEFAULT 0,
    "trainingHours" DOUBLE PRECISION,
    "safetyHours" DOUBLE PRECISION,
    "manHoursWorked" DOUBLE PRECISION,
    "correctiveActions" TEXT,
    "evidenceId" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "enteredBy" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SafetyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'TRAVEL',
    "mode" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "passengers" INTEGER NOT NULL DEFAULT 1,
    "sourceUnit" TEXT NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "travelDate" TIMESTAMP(3),
    "factorId" TEXT,
    "calculatedEmissions" DOUBLE PRECISION,
    "evidenceId" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "calculationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "enteredBy" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TravelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3),
    "reportingPeriodId" TEXT,
    "projectId" TEXT,
    "module" TEXT,
    "sourceRecordId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "verificationComment" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "suggestedAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionComment" TEXT,

    CONSTRAINT "ValidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyEvent" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "expectedRange" TEXT NOT NULL,
    "actualValue" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionComment" TEXT,

    CONSTRAINT "AnomalyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationResult" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "energyRecordId" TEXT,
    "waterRecordId" TEXT,
    "wasteRecordId" TEXT,
    "travelRecordId" TEXT,
    "factorId" TEXT,
    "factorVersion" INTEGER,
    "conversionRuleId" TEXT,
    "sourceValue" DOUBLE PRECISION NOT NULL,
    "sourceUnit" TEXT NOT NULL,
    "normalizedValue" DOUBLE PRECISION,
    "normalizedUnit" TEXT,
    "calculatedValue" DOUBLE PRECISION NOT NULL,
    "resultUnit" TEXT NOT NULL,
    "scope" TEXT,
    "methodologyNote" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoSubmission" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "recordIds" TEXT NOT NULL,
    "completionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "validationPassed" INTEGER NOT NULL DEFAULT 0,
    "validationErrors" INTEGER NOT NULL DEFAULT 0,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "currentReviewerId" TEXT,
    "reviewComment" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionStatusHistory" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "reason" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "comment" TEXT,
    "resolutionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrsrFramework" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'CORE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrsrFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrsrSection" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "BrsrSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrsrPrinciple" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "BrsrPrinciple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrsrQuestion" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "principleId" TEXT,
    "questionCode" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerType" TEXT NOT NULL,
    "unit" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "applicabilityRule" TEXT,
    "mappingSource" TEXT,
    "calculationMethod" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "BrsrQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrsrAnswer" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "projectId" TEXT,
    "reportingPeriodId" TEXT,
    "answerValue" TEXT,
    "numericValue" DOUBLE PRECISION,
    "sourceType" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "sourceRecordType" TEXT,
    "calculationResultId" TEXT,
    "evidenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "readinessWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrsrAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldState" TEXT,
    "newState" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "linkEntity" TEXT,
    "linkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "frameworkId" TEXT,
    "reportingYear" INTEGER,
    "periodLabel" TEXT,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "scopeName" TEXT,
    "generatedBy" TEXT NOT NULL,
    "generatedByName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "fileName" TEXT,
    "fileType" TEXT,
    "content" TEXT,
    "checksum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subsidiary_code_key" ON "Subsidiary"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_code_key" ON "BusinessUnit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_ref_key" ON "Submission"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Task_ref_key" ON "Task"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "BrsrReport_ref_key" ON "BrsrReport"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Disclosure_code_key" ON "Disclosure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingTimeline_ref_key" ON "ReportingTimeline"("ref");

-- CreateIndex
CREATE INDEX "ReportingTimeline_subsidiaryId_idx" ON "ReportingTimeline"("subsidiaryId");

-- CreateIndex
CREATE INDEX "ReportingTimeline_period_idx" ON "ReportingTimeline"("period");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingPackage_ref_key" ON "ReportingPackage"("ref");

-- CreateIndex
CREATE INDEX "ReportingPackage_subsidiaryId_idx" ON "ReportingPackage"("subsidiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationIssue_ref_key" ON "ValidationIssue"("ref");

-- CreateIndex
CREATE INDEX "ValidationIssue_subsidiaryId_idx" ON "ValidationIssue"("subsidiaryId");

-- CreateIndex
CREATE INDEX "EvidenceDoc_subsidiaryId_idx" ON "EvidenceDoc"("subsidiaryId");

-- CreateIndex
CREATE INDEX "EvidenceDoc_submissionId_idx" ON "EvidenceDoc"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_skey_key" ON "AppSetting"("skey");

-- CreateIndex
CREATE UNIQUE INDEX "UnitMaster_code_key" ON "UnitMaster"("code");

-- CreateIndex
CREATE INDEX "EnergyRecord_projectId_reportingPeriodId_idx" ON "EnergyRecord"("projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "WaterRecord_projectId_reportingPeriodId_idx" ON "WaterRecord"("projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "WasteRecord_projectId_reportingPeriodId_idx" ON "WasteRecord"("projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "WorkforceRecord_projectId_reportingPeriodId_idx" ON "WorkforceRecord"("projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "SafetyRecord_projectId_reportingPeriodId_idx" ON "SafetyRecord"("projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "TravelRecord_projectId_reportingPeriodId_idx" ON "TravelRecord"("projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "Evidence_projectId_idx" ON "Evidence"("projectId");

-- CreateIndex
CREATE INDEX "Evidence_uploaderId_idx" ON "Evidence"("uploaderId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRule_code_key" ON "ValidationRule"("code");

-- CreateIndex
CREATE INDEX "ValidationResult_recordId_idx" ON "ValidationResult"("recordId");

-- CreateIndex
CREATE INDEX "CalculationResult_recordId_idx" ON "CalculationResult"("recordId");

-- CreateIndex
CREATE INDEX "SoSubmission_projectId_reportingPeriodId_idx" ON "SoSubmission"("projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "SoSubmission_status_idx" ON "SoSubmission"("status");

-- CreateIndex
CREATE INDEX "SubmissionStatusHistory_submissionId_idx" ON "SubmissionStatusHistory"("submissionId");

-- CreateIndex
CREATE INDEX "CorrectionRequest_submissionId_idx" ON "CorrectionRequest"("submissionId");

-- CreateIndex
CREATE INDEX "BrsrAnswer_frameworkId_projectId_reportingPeriodId_idx" ON "BrsrAnswer"("frameworkId", "projectId", "reportingPeriodId");

-- CreateIndex
CREATE INDEX "SoAuditLog_entityId_idx" ON "SoAuditLog"("entityId");

-- CreateIndex
CREATE INDEX "SoAuditLog_actorId_idx" ON "SoAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "Activity_projectId_idx" ON "Activity"("projectId");

-- CreateIndex
CREATE INDEX "SoNotification_userId_read_idx" ON "SoNotification"("userId", "read");

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingPeriod" ADD CONSTRAINT "ReportingPeriod_reportingYearId_fkey" FOREIGN KEY ("reportingYearId") REFERENCES "ReportingYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyRecord" ADD CONSTRAINT "EnergyRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyRecord" ADD CONSTRAINT "EnergyRecord_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterRecord" ADD CONSTRAINT "WaterRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterRecord" ADD CONSTRAINT "WaterRecord_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceRecord" ADD CONSTRAINT "WorkforceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceRecord" ADD CONSTRAINT "WorkforceRecord_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyRecord" ADD CONSTRAINT "SafetyRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyRecord" ADD CONSTRAINT "SafetyRecord_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRecord" ADD CONSTRAINT "TravelRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRecord" ADD CONSTRAINT "TravelRecord_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_energyRecord_fkey" FOREIGN KEY ("recordId") REFERENCES "EnergyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_waterRecord_fkey" FOREIGN KEY ("recordId") REFERENCES "WaterRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_wasteRecord_fkey" FOREIGN KEY ("recordId") REFERENCES "WasteRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_workforceRecord_fkey" FOREIGN KEY ("recordId") REFERENCES "WorkforceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_safetyRecord_fkey" FOREIGN KEY ("recordId") REFERENCES "SafetyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_travelRecord_fkey" FOREIGN KEY ("recordId") REFERENCES "TravelRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationResult" ADD CONSTRAINT "CalculationResult_energyRecordId_fkey" FOREIGN KEY ("energyRecordId") REFERENCES "EnergyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationResult" ADD CONSTRAINT "CalculationResult_waterRecordId_fkey" FOREIGN KEY ("waterRecordId") REFERENCES "WaterRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationResult" ADD CONSTRAINT "CalculationResult_wasteRecordId_fkey" FOREIGN KEY ("wasteRecordId") REFERENCES "WasteRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationResult" ADD CONSTRAINT "CalculationResult_travelRecordId_fkey" FOREIGN KEY ("travelRecordId") REFERENCES "TravelRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoSubmission" ADD CONSTRAINT "SoSubmission_currentReviewerId_fkey" FOREIGN KEY ("currentReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoSubmission" ADD CONSTRAINT "SoSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoSubmission" ADD CONSTRAINT "SoSubmission_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionStatusHistory" ADD CONSTRAINT "SubmissionStatusHistory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "SoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "SoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrsrSection" ADD CONSTRAINT "BrsrSection_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "BrsrFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrsrPrinciple" ADD CONSTRAINT "BrsrPrinciple_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "BrsrFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrsrQuestion" ADD CONSTRAINT "BrsrQuestion_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "BrsrFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrsrQuestion" ADD CONSTRAINT "BrsrQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BrsrSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrsrQuestion" ADD CONSTRAINT "BrsrQuestion_principleId_fkey" FOREIGN KEY ("principleId") REFERENCES "BrsrPrinciple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrsrAnswer" ADD CONSTRAINT "BrsrAnswer_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "BrsrFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrsrAnswer" ADD CONSTRAINT "BrsrAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "BrsrQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoAuditLog" ADD CONSTRAINT "SoAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoNotification" ADD CONSTRAINT "SoNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ==========================================================
-- 2. Data Inserts
-- ==========================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Disable foreign key checks during data load
SET session_replication_role = 'replica';

-- Table "public"."Activity" (47 rows)
INSERT INTO "public"."Activity" ("id", "projectId", "actorId", "actorName", "actorRole", "action", "title", "description", "module", "status", "createdAt") VALUES
  ('cmvt6cx9o00487kxw3vzwloa4', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Site Officer', 'DATA_ENTRY', 'HSD Fuel Log Submitted', 'Batch #HMR-01 (18,650 L) logged for DG Heavy Fleet', 'ENERGY', 'SUBMITTED', '2026-05-03T04:30:00.000Z'),
  ('cmvt6cx9o00497kxwugipaiga', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Site Officer', 'APPROVE', 'Grid Power Log Verified', '384,000 kWh verified against BESCOM invoice', 'ENERGY', 'APPROVED', '2026-05-06T06:00:00.000Z'),
  ('cmvt6cx9o004a7kxwhuwojny4', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Site Officer', 'EVIDENCE_UPLOAD', 'STP Water Log Draft Saved', 'Water STP register uploaded, awaiting validation', 'WATER', 'DRAFT', '2026-05-04T08:50:00.000Z'),
  ('cmvt6cx9o004b7kxw4z4t3wvg', 'cmvt5842u002c7kssl8jciq2c', 'cmvt59gde00077k44q6tymhwf', 'K. Venkat', 'Plant Mech', 'CALCULATION', 'Emission Calculation Completed', 'Scope 1+2 = 344.5 tCO2e computed for April', 'ENERGY', 'COMPLETED', '2026-05-05T11:15:00.000Z'),
  ('cmw29n2ru000ke9wobempwg5x', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for BU review', 'Source record w0u-pjk3 captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T09:52:50.442Z'),
  ('cmw29o07u000ye9wojvh0c1pd', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submitted: Project — Level 1 — Energy Consumption (June 2026)', 'Submission for ENERGY moved DRAFT → SUBMITTED', 'ENERGY', 'SUBMITTED', '2026-11-04T09:53:33.786Z'),
  ('cmw29qkkw0018e9wokzcluw2f', 'cmvt5836p001t7kssxjh733ng', 'cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'PROJECT_ADMIN', 'SUBMIT', 'Level 1 — Energy Consumption submitted for BU review', 'Source record dxl-hb21 captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T09:55:33.489Z'),
  ('cmw29rsor001me9wo6wxaix4y', 'cmvt5836p001t7kssxjh733ng', 'cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'PROJECT_ADMIN', 'SUBMIT', 'Submitted: Project — Level 1 — Energy Consumption (June 2026)', 'Submission for ENERGY moved DRAFT → SUBMITTED', 'ENERGY', 'SUBMITTED', '2026-11-04T09:56:30.652Z'),
  ('cmw2azwyv0028e9wodfhro65y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record p7d-glz0 captured with 1 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T10:30:49.064Z'),
  ('cmw2b0o8r002ke9wocdwjttxy', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record i0e-43x8 captured with 1 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T10:31:24.411Z'),
  ('cmw2b3tsq0034e9wosv55g66j', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record oby-pcno captured with 1 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T10:33:51.215Z'),
  ('cmw2bzbhs003re9woodo7tf8c', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record 7fs-4e67 captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T10:58:20.540Z'),
  ('cmw2bzsuq0045e9wol0xtigc6', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submitted: Project — Level 1 — Energy Consumption (June 2026)', 'Submission for ENERGY moved DRAFT → SUBMITTED', 'ENERGY', 'SUBMITTED', '2026-11-04T10:58:43.148Z'),
  ('cmw2de09m004xe9woc91w8ewp', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Kakinada Rig Assembly & Testing Yard (April 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T11:37:45.754Z'),
  ('cmw2df24s0055e9woi3uv4bpj', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Kakinada Rig Assembly & Testing Yard (April 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T11:38:34.828Z'),
  ('cmw2dnghh005me9wos94uh9ts', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record cyl-nbzd captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T11:45:06.471Z'),
  ('cmw2do2h8005ye9wom0ehqh5x', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submitted: Project — Level 1 — Energy Consumption (June 2026)', 'Submission for ENERGY moved DRAFT → SUBMITTED', 'ENERGY', 'SUBMITTED', '2026-11-04T11:45:35.181Z'),
  ('cmw2dp1gf0069e9wo58sxp4ex', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submitted: Project — Level 1 — Energy Consumption (June 2026)', 'Submission for ENERGY moved DRAFT → SUBMITTED', 'ENERGY', 'SUBMITTED', '2026-11-04T11:46:20.511Z'),
  ('cmw2dqzho006ie9wo5oq09fxm', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 2 — Water Management submitted for Project Admin review', 'Source record vql-lrte captured with 0 issue(s).', 'WATER', 'SUBMITTED', '2026-11-04T11:47:51.276Z'),
  ('cmw2dre4q006we9wot69brwtg', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submitted: Project — Level 2 — Water Management (June 2026)', 'Submission for WATER moved DRAFT → SUBMITTED', 'WATER', 'SUBMITTED', '2026-11-04T11:48:10.024Z'),
  ('cmw2e8cmo000b7ktwtebnw9n3', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record 99w-lxbw captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T12:01:21.457Z'),
  ('cmw2eh31500057kggd8ncfyfj', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record zc6-mvp3 captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T12:08:08.921Z'),
  ('cmw2f7bxq000g7kgg8di4z2af', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record 8cj-capk captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T12:28:33.518Z'),
  ('cmw2f7uk9000t7kggtjc3fjww', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submitted: Project — Level 1 — Energy Consumption (June 2026)', 'Submission for ENERGY moved DRAFT → SUBMITTED', 'ENERGY', 'SUBMITTED', '2026-11-04T12:28:57.468Z'),
  ('cmw2fs8vq0080e9wopusked18', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T12:44:49.335Z'),
  ('cmw2ft9xc0088e9wovpu2ay4r', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T12:45:37.344Z'),
  ('cmw2fvvjv008ie9wo3cw4rseg', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T12:47:38.683Z'),
  ('cmw2g67mz0095e9woiqzzw97y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record 2zk-zqtu captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T12:55:40.693Z'),
  ('cmw2g6noi009de9woiriq5fm3', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 2 — Water Management submitted for Project Admin review', 'Source record jq6-65zt captured with 0 issue(s).', 'WATER', 'SUBMITTED', '2026-11-04T12:56:01.698Z'),
  ('cmw2gwkqs009ve9wotsg31p8v', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record go8-spsx captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T13:16:10.948Z'),
  ('cmw2gxrc000a6e9wojtvqz445', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 2 — Water Management submitted for Project Admin review', 'Source record lyp-axp4 captured with 0 issue(s).', 'WATER', 'SUBMITTED', '2026-11-04T13:17:06.145Z'),
  ('cmw2gziuk00aue9woeyu31qgf', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for HH-300 Automated Hydraulic Rigs Line (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T13:18:28.461Z'),
  ('cmw2gzy3p00b0e9wo6wia3eck', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for HH-300 Automated Hydraulic Rigs Line (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T13:18:48.229Z'),
  ('cmw2tkikm00137kggpiss60h2', 'cmvt5842u002c7kssl8jciq2c', 'cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'PROJECT_ADMIN', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record cso-wdhd captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T19:10:43.008Z'),
  ('cmw2ts5b6001h7kggkedfhliy', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record zud-tr13 captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T19:16:38.993Z'),
  ('cmw2ttk4f001p7kggu6ugdnr2', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record fof-s0gf captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T19:17:45.183Z'),
  ('cmw2ttwqz00207kgg1lcqtl28', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 2 — Water Management submitted for Project Admin review', 'Source record rhq-u3iy captured with 0 issue(s).', 'WATER', 'SUBMITTED', '2026-11-04T19:18:01.236Z'),
  ('cmw2tu62r00287kgg0gs76pvv', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 3 — GHG Emissions & Air Quality submitted for Project Admin review', 'Source record 1yo-2ed8 captured with 0 issue(s).', 'EMISSIONS', 'SUBMITTED', '2026-11-04T19:18:13.636Z'),
  ('cmw2tumtl002k7kgg92fbeg1r', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 4 — Waste Management submitted for Project Admin review', 'Source record hlu-g5iq captured with 0 issue(s).', 'WASTE', 'SUBMITTED', '2026-11-04T19:18:35.039Z'),
  ('cmw2tv44y002t7kgg3xai7mc5', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 5 — Environmental Permits & Compliance submitted for Project Admin review', 'Source record zm7-bfuw captured with 0 issue(s).', 'COMPLIANCE', 'SUBMITTED', '2026-11-04T19:18:57.778Z'),
  ('cmw2tvfg200337kgga568z9r9', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 6 — Environmental Initiatives submitted for Project Admin review', 'Source record b7x-wva8 captured with 0 issue(s).', 'INITIATIVES', 'SUBMITTED', '2026-11-04T19:19:12.435Z'),
  ('cmw2tvww4003d7kggrlb6odsl', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T19:19:35.044Z'),
  ('cmw2u3vkb003o7kggw941adhk', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Level 1 — Energy Consumption submitted for Project Admin review', 'Source record qy9-q5xx captured with 0 issue(s).', 'ENERGY', 'SUBMITTED', '2026-11-04T19:25:46.571Z'),
  ('cmw2u4fp2003z7kggpnp4k2pz', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T19:26:10.520Z'),
  ('cmw2u5b8200437kgg43n22byi', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T19:26:53.522Z'),
  ('cmw2u7x98004a7kgg60b66xhf', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T19:28:55.388Z'),
  ('cmw2ukbmf004j7kgg6dyt4jr5', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'All 9 Site Levels Submitted to Project Admin', 'Complete disclosure package submitted for Pavagada Mega Solar Complex Expansion (June 2026).', 'ALL_LEVELS', 'SUBMITTED', '2026-11-04T19:38:33.879Z');

-- Table "public"."ActivityEvent" (31 rows)
INSERT INTO "public"."ActivityEvent" ("id", "actorName", "actorRole", "action", "targetType", "targetLabel", "orgLabel", "severity", "createdAt") VALUES
  ('cmw29n8nr000ne9woxfl8l5mz', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw29mzly000ie9wovwaawe4s — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T09:52:58.071Z'),
  ('cmw29o5bz000ze9wo6k3vunnt', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw29no6s000se9woi4mz4ejy — Project — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T09:53:40.415Z'),
  ('cmw29qr1d001be9wo90rravwu', 'Er. K. Venkataramana', 'PORTAL:PROJECT_ADMIN', 'SUBMIT', 'Submission', 'PU-cmw29qhbi0016e9wo8tcmoxp8 — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T09:55:41.857Z'),
  ('cmw29rxtp001ne9wohmqkpcdm', 'Er. K. Venkataramana', 'PORTAL:PROJECT_ADMIN', 'SUBMIT', 'Submission', 'PU-cmw29rhe5001ge9wo5yykjkdc — Project — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T09:56:37.309Z'),
  ('cmw2b04lm002be9wop5vysih4', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2azuyd0026e9wo56uimwjc — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T10:30:58.955Z'),
  ('cmw2b0u1b002ne9wop72nadla', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2b0m0a002ie9wogv9b3480 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T10:31:31.919Z'),
  ('cmw2b3zb90035e9wo0d2ci0r4', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2b3pd40030e9wof2blenck — Kakinada Rig Assembly & Testing Yard — Level 1 — Energy Consumption (April 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · Kakinada Rig Assembly & Testing Yard', 'INFO', '2026-11-04T10:33:58.725Z'),
  ('cmw2bzh6d003ue9wohmcosms1', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2bz902003pe9woj09b1z3y — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T10:58:28.213Z'),
  ('cmw2bzxpo0046e9wo1ftrmvn3', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2bzjcu003ye9wodl8r6lvz — Project — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T10:58:49.645Z'),
  ('cmw2dnlq6005ne9woju4jms59', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2dnelx005ie9wo3l8gpzhe — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T11:45:13.471Z'),
  ('cmw2do7to005ze9wojsqot5tv', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2dns7e005se9wo5c830bwd — Project — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T11:45:42.109Z'),
  ('cmw2dp6ap006be9woqi0dvdmq', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2dotyg0064e9womt3d1upm — Project — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T11:46:26.786Z'),
  ('cmw2dr4e3006le9wo97k9lynt', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2dqxpb006ge9woeof9pfn2 — HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T11:47:57.627Z'),
  ('cmw2drj7n006xe9woisap5aly', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2dr4n7006ne9woeykdmzzq — Project — Level 2 — Water Management (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T11:48:16.835Z'),
  ('cmw2e8go6000e7ktwl13yoq0p', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2e8awm00097ktw9iiiwgl9 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T12:01:26.694Z'),
  ('cmw2eh7ia00087kgggxudkua1', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2eh1aq00037kggbe6w0yqw — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T12:08:14.723Z'),
  ('cmw2f7gh2000i7kgg0lslz3b1', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2f7a9t000d7kggf57ezatm — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T12:28:39.398Z'),
  ('cmw2f7yx9000u7kggmtcwki17', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2f7lny000n7kggnesw78ox — Project — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T12:29:03.309Z'),
  ('cmw2g6chn0096e9wofs5lvaii', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2g658j0091e9wo140rnqhl — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T12:55:47.195Z'),
  ('cmw2g6t1h009ge9wor4csc354', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2g6ll0009be9wob6zi3c7x — HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T12:56:08.645Z'),
  ('cmw2gwqjl009ye9woc1xj131p', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2gwiom009te9wopvdyyjhz — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T13:16:18.465Z'),
  ('cmw2gxxen00a8e9woehs1awyv', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2gxpd000a3e9wosu5x16x5 — HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line', 'INFO', '2026-11-04T13:17:14.016Z'),
  ('cmw2tkoql00167kggp8zqe14g', 'Er. K. Venkataramana', 'PORTAL:PROJECT_ADMIN', 'SUBMIT', 'Submission', 'PU-cmw2tkfqc00117kggxawfmxi8 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:10:51.262Z'),
  ('cmw2tsbs9001i7kgg7tyndaz5', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2ts2dq001d7kgg8z5g9fdp — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:16:47.721Z'),
  ('cmw2ttphe001s7kggbertemrz', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2tti6u001n7kggeb1mo6nv — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:17:52.130Z'),
  ('cmw2tu2uv00227kggjht1d2ds', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2ttto6001x7kgg7n8rbgh2 — Pavagada Mega Solar Complex Expansion — Level 2 — Water Management (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:18:09.463Z'),
  ('cmw2tud3t002c7kgg5va6bycu', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2tu32n00247kggx7xvcsjh — Pavagada Mega Solar Complex Expansion — Level 3 — GHG Emissions & Air Quality (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:18:22.745Z'),
  ('cmw2tuszo002m7kggsb1uvsn0', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2tukdm002h7kggohh1c9vj — Pavagada Mega Solar Complex Expansion — Level 4 — Waste Management (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:18:43.332Z'),
  ('cmw2tvarq002w7kggwkkxsg1e', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2tv14p002r7kggeesb24as — Pavagada Mega Solar Complex Expansion — Level 5 — Environmental Permits & Compliance (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:19:06.375Z'),
  ('cmw2tvmgm00367kggdimk3lzx', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2tvclo002z7kggl6jvrph1 — Pavagada Mega Solar Complex Expansion — Level 6 — Environmental Initiatives (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:19:21.526Z'),
  ('cmw2u40r7003r7kggry0yyx38', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMIT', 'Submission', 'PU-cmw2u3t0u003m7kggr41hvt48 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion', 'INFO', '2026-11-04T19:25:53.299Z');

-- Table "public"."AnomalyEvent" (0 rows)

-- Table "public"."AppSetting" (8 rows)
INSERT INTO "public"."AppSetting" ("id", "skey", "label", "category", "svalue", "vtype", "options", "updatedAt") VALUES
  ('cmvt58ekk00737kss21ttaoso', 'brsr_framework', 'BRSR framework version', 'REPORTING', '{"value":"SEBI BRSR Core v1.0"}', 'select', '["SEBI BRSR Core v1.0","SEBI BRSR Core v1.1 (draft)"]', '2026-10-29T00:39:31.844Z'),
  ('cmvt58ekk00747kssoxx1kq8g', 'emissions_factor_set', 'Emissions factor set', 'CALCULATION', '{"value":"GHG Protocol — India Grid 2024 (v4.2)"}', 'select', '["GHG Protocol — India Grid 2024 (v4.2)","GHG Protocol — India Grid 2023 (v4.1)"]', '2026-10-29T00:39:31.844Z'),
  ('cmvt58ekk00757kssclhtgvbe', 'approval_stages', 'Approval workflow stages', 'WORKFLOW', '{"value":"Group Admin → CFO (BRSR only)"}', 'text', '[]', '2026-10-29T00:39:31.844Z'),
  ('cmvt58ekk00717ksszciktt4w', 'q2_freeze_date', 'Q2 FY26 data freeze date', 'REPORTING', '{"value":"2026-11-18"}', 'text', '[]', '2026-10-29T00:39:31.844Z'),
  ('cmvt58ekk00767kssrlqrceg2', 'reminder_cadence_days', 'Deadline reminder cadence (days)', 'REMINDERS', '{"value":3}', 'number', '[]', '2026-10-29T00:39:31.844Z'),
  ('cmvt58er700787kss5bdgq5i6', 'session_timeout_min', 'Session timeout (minutes)', 'SECURITY', '{"value":30}', 'number', '[]', '2026-10-29T00:39:31.845Z'),
  ('cmvt58ekk00727ksscmlk6h5p', 'escalation_enabled', 'Auto-escalate overdue tasks to managers', 'REMINDERS', '{"value":true}', 'toggle', '[]', '2026-10-29T00:39:31.844Z'),
  ('cmvt58er500777ksspf2bzuhv', 'reporting_year', 'Active reporting year', 'REPORTING', '{"value":"FY 2025-26"}', 'select', '["FY 2024-25","FY 2025-26","FY 2026-27"]', '2026-10-29T00:39:31.844Z');

-- Table "public"."AuditEvent" (31 rows)
INSERT INTO "public"."AuditEvent" ("id", "actorName", "actorRole", "action", "targetType", "targetId", "targetLabel", "orgScope", "before", "after", "reason", "outcome", "correlation", "createdAt") VALUES
  ('cmw29n9nk000oe9woe4bdqsh8', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw29mzly000ie9wovwaawe4s', 'PU-cmw29mzly000ie9wovwaawe4s — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw29mzly000ie9wovwaawe4s', '2026-11-04T09:52:59.172Z'),
  ('cmw29o6720010e9wod899w6rz', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw29no6s000se9woi4mz4ejy', 'PU-cmw29no6s000se9woi4mz4ejy — Project — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw29no6s000se9woi4mz4ejy', '2026-11-04T09:53:41.534Z'),
  ('cmw29qs0x001ce9wofmtohoj3', 'Er. K. Venkataramana', 'PORTAL:PROJECT_ADMIN', 'SUBMISSION_CREATE', 'Submission', 'cmw29qhbi0016e9wo8tcmoxp8', 'PU-cmw29qhbi0016e9wo8tcmoxp8 — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw29qhbi0016e9wo8tcmoxp8', '2026-11-04T09:55:43.138Z'),
  ('cmw29rymg001oe9wo0czzh4uy', 'Er. K. Venkataramana', 'PORTAL:PROJECT_ADMIN', 'SUBMISSION_CREATE', 'Submission', 'cmw29rhe5001ge9wo5yykjkdc', 'PU-cmw29rhe5001ge9wo5yykjkdc — Project — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw29rhe5001ge9wo5yykjkdc', '2026-11-04T09:56:38.345Z'),
  ('cmw2b05pl002ce9wo6m747das', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2azuyd0026e9wo56uimwjc', 'PU-cmw2azuyd0026e9wo56uimwjc — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2azuyd0026e9wo56uimwjc', '2026-11-04T10:31:00.394Z'),
  ('cmw2b0uwb002oe9wosxd6a3q7', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2b0m0a002ie9wogv9b3480', 'PU-cmw2b0m0a002ie9wogv9b3480 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2b0m0a002ie9wogv9b3480', '2026-11-04T10:31:33.035Z'),
  ('cmw2b40xa0036e9woymoznin1', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2b3pd40030e9wof2blenck', 'PU-cmw2b3pd40030e9wof2blenck — Kakinada Rig Assembly & Testing Yard — Level 1 — Energy Consumption (April 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2b3pd40030e9wof2blenck', '2026-11-04T10:34:00.814Z'),
  ('cmw2bziad003ve9woeq0bb9mq', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2bz902003pe9woj09b1z3y', 'PU-cmw2bz902003pe9woj09b1z3y — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2bz902003pe9woj09b1z3y', '2026-11-04T10:58:29.653Z'),
  ('cmw2bzyq60047e9wojvhfpvo3', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2bzjcu003ye9wodl8r6lvz', 'PU-cmw2bzjcu003ye9wodl8r6lvz — Project — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2bzjcu003ye9wodl8r6lvz', '2026-11-04T10:58:50.959Z'),
  ('cmw2dnmu7005oe9wo514ppbsc', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2dnelx005ie9wo3l8gpzhe', 'PU-cmw2dnelx005ie9wo3l8gpzhe — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2dnelx005ie9wo3l8gpzhe', '2026-11-04T11:45:14.912Z'),
  ('cmw2do8tb0060e9wov7oakocg', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2dns7e005se9wo5c830bwd', 'PU-cmw2dns7e005se9wo5c830bwd — Project — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2dns7e005se9wo5c830bwd', '2026-11-04T11:45:43.391Z'),
  ('cmw2dp754006ce9wo9yki87ks', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2dotyg0064e9womt3d1upm', 'PU-cmw2dotyg0064e9womt3d1upm — Project — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2dotyg0064e9womt3d1upm', '2026-11-04T11:46:27.880Z'),
  ('cmw2dr59o006oe9wolxcfvdo6', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2dqxpb006ge9woeof9pfn2', 'PU-cmw2dqxpb006ge9woeof9pfn2 — HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2dqxpb006ge9woeof9pfn2', '2026-11-04T11:47:58.765Z'),
  ('cmw2drkfv006ye9wopdfn7gme', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2dr4n7006ne9woeykdmzzq', 'PU-cmw2dr4n7006ne9woeykdmzzq — Project — Level 2 — Water Management (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2dr4n7006ne9woeykdmzzq', '2026-11-04T11:48:18.428Z'),
  ('cmw2e8hdi000f7ktw0uebeek3', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2e8awm00097ktw9iiiwgl9', 'PU-cmw2e8awm00097ktw9iiiwgl9 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2e8awm00097ktw9iiiwgl9', '2026-11-04T12:01:27.607Z'),
  ('cmw2eh89b00097kgg827hwguo', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2eh1aq00037kggbe6w0yqw', 'PU-cmw2eh1aq00037kggbe6w0yqw — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2eh1aq00037kggbe6w0yqw', '2026-11-04T12:08:15.696Z'),
  ('cmw2f7h7d000j7kggg7ly3rau', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2f7a9t000d7kggf57ezatm', 'PU-cmw2f7a9t000d7kggf57ezatm — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2f7a9t000d7kggf57ezatm', '2026-11-04T12:28:40.345Z'),
  ('cmw2f7zsg000v7kggum027udm', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2f7lny000n7kggnesw78ox', 'PU-cmw2f7lny000n7kggnesw78ox — Project — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2f7lny000n7kggnesw78ox', '2026-11-04T12:29:04.432Z'),
  ('cmw2g6dcr0097e9wovpprt8hb', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2g658j0091e9wo140rnqhl', 'PU-cmw2g658j0091e9wo140rnqhl — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2g658j0091e9wo140rnqhl', '2026-11-04T12:55:48.315Z'),
  ('cmw2g6twv009he9wodk96oapm', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2g6ll0009be9wob6zi3c7x', 'PU-cmw2g6ll0009be9wob6zi3c7x — HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2g6ll0009be9wob6zi3c7x', '2026-11-04T12:56:09.775Z'),
  ('cmw2gwrrz009ze9wo6v1ffici', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2gwiom009te9wopvdyyjhz', 'PU-cmw2gwiom009te9wopvdyyjhz — HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2gwiom009te9wopvdyyjhz', '2026-11-04T13:16:20.064Z'),
  ('cmw2gxy6100a9e9wodc6bz181', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2gxpd000a3e9wosu5x16x5', 'PU-cmw2gxpd000a3e9wosu5x16x5 — HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'DRILLMEC', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2gxpd000a3e9wosu5x16x5', '2026-11-04T13:17:15.001Z'),
  ('cmw2tkq6400177kgg1e5es3ug', 'Er. K. Venkataramana', 'PORTAL:PROJECT_ADMIN', 'SUBMISSION_CREATE', 'Submission', 'cmw2tkfqc00117kggxawfmxi8', 'PU-cmw2tkfqc00117kggxawfmxi8 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2tkfqc00117kggxawfmxi8', '2026-11-04T19:10:53.116Z'),
  ('cmw2tscw3001j7kggavyb2zaw', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2ts2dq001d7kgg8z5g9fdp', 'PU-cmw2ts2dq001d7kgg8z5g9fdp — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2ts2dq001d7kgg8z5g9fdp', '2026-11-04T19:16:49.155Z'),
  ('cmw2ttqlj001t7kgg49oaq74s', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2tti6u001n7kggeb1mo6nv', 'PU-cmw2tti6u001n7kggeb1mo6nv — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2tti6u001n7kggeb1mo6nv', '2026-11-04T19:17:53.575Z'),
  ('cmw2tu3xr00257kggbmvn13nj', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2ttto6001x7kgg7n8rbgh2', 'PU-cmw2ttto6001x7kgg7n8rbgh2 — Pavagada Mega Solar Complex Expansion — Level 2 — Water Management (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2ttto6001x7kgg7n8rbgh2', '2026-11-04T19:18:10.863Z'),
  ('cmw2tuej2002d7kggsyak2spf', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2tu32n00247kggx7xvcsjh', 'PU-cmw2tu32n00247kggx7xvcsjh — Pavagada Mega Solar Complex Expansion — Level 3 — GHG Emissions & Air Quality (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2tu32n00247kggx7xvcsjh', '2026-11-04T19:18:24.590Z'),
  ('cmw2tuucg002n7kgg4qnbt6tm', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2tukdm002h7kggohh1c9vj', 'PU-cmw2tukdm002h7kggohh1c9vj — Pavagada Mega Solar Complex Expansion — Level 4 — Waste Management (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2tukdm002h7kggohh1c9vj', '2026-11-04T19:18:45.088Z'),
  ('cmw2tvc3z002x7kggkfsg8dru', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2tv14p002r7kggeesb24as', 'PU-cmw2tv14p002r7kggeesb24as — Pavagada Mega Solar Complex Expansion — Level 5 — Environmental Permits & Compliance (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2tv14p002r7kggeesb24as', '2026-11-04T19:19:08.112Z'),
  ('cmw2tvnvt00377kgg43lmyqof', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2tvclo002z7kggl6jvrph1', 'PU-cmw2tvclo002z7kggl6jvrph1 — Pavagada Mega Solar Complex Expansion — Level 6 — Environmental Initiatives (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2tvclo002z7kggl6jvrph1', '2026-11-04T19:19:23.369Z'),
  ('cmw2u41pm003s7kggrwyyffn1', 'Rohit Kumar', 'PORTAL:PROJECT_USER', 'SUBMISSION_CREATE', 'Submission', 'cmw2u3t0u003m7kggr41hvt48', 'PU-cmw2u3t0u003m7kggr41hvt48 — Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'MSOLAR', '{}', '{"status":"SUBMITTED","source":"PROJECT_PORTAL"}', '', 'SUCCESS', 'pu-cmw2u3t0u003m7kggr41hvt48', '2026-11-04T19:25:54.538Z');

-- Table "public"."AuditLog" (87 rows)
INSERT INTO "public"."AuditLog" ("id", "eventType", "result", "employeeId", "userId", "portal", "role", "scopeRef", "reason", "detail", "ip", "userAgent", "createdAt") VALUES
  ('cmvxs30fe00017k60soi8fg6p', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-01T06:30:16.079Z'),
  ('cmvxs4jzt00037k60va6z4l1a', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-01T06:31:28.121Z'),
  ('cmvxsmb6400057k60i9zgo4xk', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-01T06:45:16.491Z'),
  ('cmvxsnmhv00077k60o8de5uf8', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-01T06:46:17.827Z'),
  ('cmvzb6ys50003e9jw5sj9e0wf', 'LOGIN_SUCCESS', 'SUCCESS', 'GRP-0001', 'cmvt585d1003b7kssa9gqdy4a', 'group', 'GROUP_ADMIN', 'GROUP', NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-IN) WindowsPowerShell/5.1.26100.9711', '2026-11-02T08:12:59.477Z'),
  ('cmvzbe3jm0005e9jwnfwx6ohj', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-02T08:18:32.239Z'),
  ('cmvzbgppw0007e9jwammcj78t', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-02T08:20:34.293Z'),
  ('cmvzcb58f0009e9jwozfhiotu', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-02T08:44:14.076Z'),
  ('cmvzduwti000be9jwwpc4of5k', 'LOGIN_FAILED', 'FAILURE', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', NULL, 'SCOPE_MISMATCH', 'project', '::1', 'node', '2026-11-02T09:27:35.909Z'),
  ('cmvzdvemi000de9jwzxo5v295', 'LOGIN_FAILED', 'FAILURE', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', NULL, 'SCOPE_MISMATCH', 'project', '::1', 'node', '2026-11-02T09:27:58.986Z'),
  ('cmvzdytdi000fe9jwch7t21ch', 'LOGIN_FAILED', 'FAILURE', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', NULL, 'SCOPE_MISMATCH', 'project', '::1', 'node', '2026-11-02T09:30:38.070Z'),
  ('cmvzdzh5r000je9jw830v1qvg', 'LOGIN_SUCCESS', 'SUCCESS', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', 'HCIT', NULL, NULL, '::1', 'node', '2026-11-02T09:31:08.895Z'),
  ('cmvze1uck000ne9jwzbespxk9', 'LOGIN_SUCCESS', 'SUCCESS', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', 'HCIT', NULL, NULL, '::1', 'node', '2026-11-02T09:32:59.301Z'),
  ('cmvzeulpy000pe9jwvzode5qe', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-02T09:55:21.140Z'),
  ('cmvzfj02e000te9jwfbl7tw5k', 'LOGIN_SUCCESS', 'SUCCESS', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', 'HCIT', NULL, NULL, '::1', 'node', '2026-11-02T10:14:19.477Z'),
  ('cmvzfmgy30018e9jw8k4et5sh', 'LOGIN_SUCCESS', 'SUCCESS', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', 'HCIT', NULL, NULL, '::1', 'node', '2026-11-02T10:17:01.323Z'),
  ('cmvzfucfa001ce9jww3ulai4w', 'LOGIN_SUCCESS', 'SUCCESS', 'PRJ-ADMIN', 'cmvt5869900467ksshlt6lz2z', 'project', 'PROJECT_ADMIN', 'HCIT', NULL, NULL, '::1', 'node', '2026-11-02T10:23:08.710Z'),
  ('cmw0cb9b000017ktw36mm0h7r', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-03T01:32:05.530Z'),
  ('cmw2553q90001e9wo0jx38ntf', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T07:46:53.403Z'),
  ('cmw27mmyf0003e9woy2bqe6ap', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T08:56:30.431Z'),
  ('cmw27p71w0005e9woz7nu83rk', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T08:58:29.801Z'),
  ('cmw27sjju0007e9wowo21482m', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T09:01:06.234Z'),
  ('cmw29hhrb000ce9wompogm58k', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T09:48:29.928Z'),
  ('cmw29ogcd0014e9wo9sin4eij', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T09:53:54.685Z'),
  ('cmw2a201x001se9wofv1ba05l', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Bun/1.4.2', '2026-11-04T10:04:26.757Z'),
  ('cmw2a34fb0001e9wck9az7xl3', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-04T10:05:19.080Z'),
  ('cmw2a8qvo001ue9wo3mfjn7ex', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Bun/1.4.2', '2026-11-04T10:09:41.461Z'),
  ('cmw2a9pmn001we9womnxp0737', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Bun/1.4.2', '2026-11-04T10:10:24.667Z'),
  ('cmw2a9waj001ye9wowttgu5v3', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Bun/1.4.2', '2026-11-04T10:10:35.131Z'),
  ('cmw2aihpm0020e9wozpzo0nqr', 'LOGIN_FAILED', 'FAILURE', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:17:16.138Z'),
  ('cmw2akaov0022e9wobou6joqg', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:18:40.114Z'),
  ('cmw2az90f0024e9wofyqsfzhw', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:30:14.644Z'),
  ('cmw2b0d3w002ge9wo75orsb3o', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:31:09.980Z'),
  ('cmw2b17re002se9woareehmkx', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:31:49.520Z'),
  ('cmw2b1err002ue9wockqvse3a', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:31:58.792Z'),
  ('cmw2b1lt4002we9wodf7um0t5', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:32:07.650Z'),
  ('cmw2b36ej002ye9won8kwmjlp', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T10:33:21.260Z'),
  ('cmw2b4yjs0039e9wocsggazph', 'LOGIN_FAILED', 'FAILURE', 'projectadmin@meil-esg.in', NULL, 'project', 'PROJECT_ADMIN', NULL, 'VALIDATION', 'projectId', '::1', 'Python-urllib/3.13', '2026-11-04T10:34:44.125Z'),
  ('cmw2b56te003ae9woncetbaii', 'LOGIN_FAILED', 'FAILURE', 'projectadmin@meil-esg.in', NULL, 'project', 'PROJECT_ADMIN', NULL, 'VALIDATION', 'projectId', '::1', 'Python-urllib/3.13', '2026-11-04T10:34:55.107Z'),
  ('cmw2b5gtj003ce9wo0e73petb', 'LOGIN_FAILED', 'FAILURE', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'PRJ-KKD-RIG', 'SCOPE_MISMATCH', 'project', '::1', 'Python-urllib/3.13', '2026-11-04T10:35:08.072Z'),
  ('cmw2b7sa8003ge9woqulnm3p0', 'LOGIN_SUCCESS', 'SUCCESS', 'ADM-1001', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T10:36:56.240Z'),
  ('cmw2bxu8z003le9wozkzwz7lk', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T10:57:11.843Z'),
  ('cmw2byupi003ne9wozrnzds56', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T10:57:59.095Z'),
  ('cmw2c207t004be9woxt28mhdo', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T11:00:25.988Z'),
  ('cmw2ddd9u004de9wo7p5n6fv0', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T11:37:15.954Z'),
  ('cmw2derxv0052e9wogelwqfbq', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T11:38:21.395Z'),
  ('cmw2df7dp005be9woa2plyi1v', 'LOGIN_SUCCESS', 'SUCCESS', 'ADM-1001', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T11:38:41.629Z'),
  ('cmw2dmy3p005ge9wotw8rw0yw', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T11:44:42.853Z'),
  ('cmw2dtvj10078e9wo812zb2ap', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T11:50:06.110Z'),
  ('cmw2e0w4l00037ktwzai3d8tq', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T11:55:33.478Z');
INSERT INTO "public"."AuditLog" ("id", "eventType", "result", "employeeId", "userId", "portal", "role", "scopeRef", "reason", "detail", "ip", "userAgent", "createdAt") VALUES
  ('cmw2e34wi00057ktwpojqn61n', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T11:57:17.969Z'),
  ('cmw2e7s5400077ktw8omiejg7', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T12:00:54.904Z'),
  ('cmw2e8rtv000j7ktwwvtx9kld', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T12:01:41.155Z'),
  ('cmw2egoaz00017kggkcvzfewh', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T12:07:49.835Z'),
  ('cmw2fnkom007ae9woxoabcqke', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T12:41:11.351Z'),
  ('cmw2fpphz007ce9wo46ec8isz', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T12:42:50.682Z'),
  ('cmw2fqq49007ee9wo6saxnbik', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T12:43:38.114Z'),
  ('cmw2fryzw007ge9wo6duqfe15', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T12:44:36.300Z'),
  ('cmw2ft2i10085e9woqtgk8vus', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T12:45:26.249Z'),
  ('cmw2ftem7008ee9wo4qnuom2o', 'LOGIN_SUCCESS', 'SUCCESS', 'ADM-1001', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T12:45:43.220Z'),
  ('cmw2fvmyr008ge9woor1ucof9', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Python-urllib/3.13', '2026-11-04T12:47:27.555Z'),
  ('cmw2fvy5z008pe9wog3lczvwq', 'LOGIN_SUCCESS', 'SUCCESS', 'ADM-1001', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T12:47:42.071Z'),
  ('cmw2fx07s008te9wotenvvvra', 'LOGIN_SUCCESS', 'SUCCESS', 'ADM-1001', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T12:48:31.384Z'),
  ('cmw2fy9bw008xe9wow7o7g3js', 'LOGIN_SUCCESS', 'SUCCESS', 'ADM-1001', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T12:49:29.852Z'),
  ('cmw2g59pz008ze9woyrkdplsp', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T12:54:56.749Z'),
  ('cmw2gsm5i009le9wold7kz395', 'LOGIN_FAILED', 'FAILURE', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', 'project', 'ENV_DATA_USER', 'PRJ-RIG-HH300', 'SCOPE_MISMATCH', 'project', '::1', 'Python-urllib/3.13', '2026-11-04T13:13:06.151Z'),
  ('cmw2gt8qq009ne9woeju0zw1x', 'LOGIN_FAILED', 'FAILURE', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', 'project', 'ENV_DATA_USER', 'PRJ-RIG-HH300', 'SCOPE_MISMATCH', 'project', '::1', 'Bun/1.4.2', '2026-11-04T13:13:35.427Z'),
  ('cmw2gtq4u009re9wof7jbcqd2', 'LOGIN_SUCCESS', 'SUCCESS', 'PU-ENV-014', 'cmvt596uj00017k44uqelt2ry', 'project', 'ENV_DATA_USER', 'ARAM', NULL, NULL, '::1', 'Bun/1.4.2', '2026-11-04T13:13:57.967Z'),
  ('cmw2h177j00b3e9woy3k4jtv5', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T13:19:46.687Z'),
  ('cmw2h33ud00b9e9wopzvkm6pc', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36', '2026-11-04T13:21:15.637Z'),
  ('cmw2hecmo00bde9woai27hrw1', 'LOGIN_SUCCESS', 'SUCCESS', 'PU-ENV-014', 'cmvt596uj00017k44uqelt2ry', 'project', 'ENV_DATA_USER', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T13:30:00.240Z'),
  ('cmw2hixaj00bhe9wol7ln5e23', 'LOGIN_SUCCESS', 'SUCCESS', 'PU-ENV-014', 'cmvt596uj00017k44uqelt2ry', 'project', 'ENV_DATA_USER', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T13:33:33.644Z'),
  ('cmw2hm4ej00bje9wo1okse6g6', 'LOGIN_FAILED', 'FAILURE', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'PRJ-PVG-SOL', 'SCOPE_MISMATCH', 'project', '::1', 'Python-urllib/3.13', '2026-11-04T13:36:02.828Z'),
  ('cmw2huxkh00bne9wobsipnooc', 'LOGIN_SUCCESS', 'SUCCESS', 'PU-ENV-014', 'cmvt596uj00017k44uqelt2ry', 'project', 'ENV_DATA_USER', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T13:42:53.873Z'),
  ('cmw2hvcvd00bre9woo5xmufac', 'LOGIN_SUCCESS', 'SUCCESS', 'PU-ENV-014', 'cmvt596uj00017k44uqelt2ry', 'project', 'ENV_DATA_USER', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T13:43:13.705Z'),
  ('cmw2hvs1800bve9wouvffu71d', 'LOGIN_SUCCESS', 'SUCCESS', 'ADM-1001', 'cmvt59nan000f7k44ov5pssam', 'project', 'PROJECT_ADMIN', 'ARAM', NULL, NULL, '::1', 'Python-urllib/3.13', '2026-11-04T13:43:33.356Z'),
  ('cmw2tk1qp000z7kggop8ulg4v', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:10:21.457Z'),
  ('cmw2triom001b7kgga7prg5zc', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:16:09.730Z'),
  ('cmw2txthm003g7kggri9x3gnx', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:21:03.944Z'),
  ('cmw2u31g1003i7kggcikvx638', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:25:07.537Z'),
  ('cmw2u3m45003k7kggtbaemi2s', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:25:33.996Z'),
  ('cmw2u8xwt004f7kggu3g3gtpe', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:29:42.893Z'),
  ('cmw2u620q00467kggo1un0qgg', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:27:28.250Z'),
  ('cmw2u7d4y00487kggrrhm9oci', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:28:29.314Z'),
  ('cmw2uiut8004h7kgg9ym35yt7', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:37:25.436Z'),
  ('cmw2ukpf7004o7kggch4jgbkk', 'LOGIN_SUCCESS', 'SUCCESS', 'projectadmin@meil-esg.in', 'cmvt59nan000f7k44ov5pssam', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:38:51.763Z'),
  ('cmw2ulxo5004w7kggur9c3z4g', 'LOGIN_SUCCESS', 'SUCCESS', 'rohit@meil-esg.in', 'cmvt596uj00017k44uqelt2ry', NULL, NULL, NULL, NULL, NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '2026-11-04T19:39:49.109Z');

-- Table "public"."BrsrAnswer" (21 rows)
INSERT INTO "public"."BrsrAnswer" ("id", "frameworkId", "questionId", "projectId", "reportingPeriodId", "answerValue", "numericValue", "sourceType", "sourceRecordId", "sourceRecordType", "calculationResultId", "evidenceId", "status", "readinessWeight", "updatedAt") VALUES
  ('cmvt6d032004f7kxw96dc8vr6', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6brw9001o7kxwqo2ydswe', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'SUBSIDIARY.cin', NULL, 'MANUAL', NULL, NULL, NULL, NULL, 'MISSING', 1, '2026-10-29T01:11:05.965Z'),
  ('cmvt6d108004h7kxw600ww6eu', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bsyo001q7kxwi77khlbs', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'SUBSIDIARY.name', NULL, 'MANUAL', NULL, NULL, NULL, NULL, 'MISSING', 1, '2026-10-29T01:11:07.161Z'),
  ('cmvt6d1xn004j7kxw9t3ak83a', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6btu8001s7kxw1wckf893', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WORKFORCE.total', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:08.363Z'),
  ('cmvt6d2ze004l7kxwupt4ud91', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6buql001u7kxwe0wmc9el', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WORKFORCE.workers', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:09.722Z'),
  ('cmvt6d3wc004n7kxwbog8ym9x', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bvmq001w7kxw01lay3sa', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'FINANCIAL.turnover', NULL, 'MANUAL', NULL, NULL, NULL, NULL, 'MISSING', 1, '2026-10-29T01:11:10.909Z'),
  ('cmvt6d4u2004p7kxwnm4y3qef', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bwiq001y7kxwp6a1mw0c', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WORKFORCE.permanent', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:12.122Z'),
  ('cmvt6d5qb004r7kxwgybqw5b7', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bxeq00207kxwctpjo9k4', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WORKFORCE.nonPermanent', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:13.283Z'),
  ('cmvt6d6v8004t7kxwq2h5uvck', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6byb400227kxw4gitkov8', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'SAFETY.fatalities', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:14.522Z'),
  ('cmvt6d7sn004v7kxw6qpr2doy', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bz8600247kxw5utjpr3k', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'SAFETY.ltifr', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:15.959Z'),
  ('cmvt6d8tc004x7kxw3h6i7uz3', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c03l00267kxwd1gkuv5y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WORKFORCE.trainingHours', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:17.281Z'),
  ('cmvt6dae7004z7kxwhg5w0td5', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c0z800287kxw0lqbov45', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY.scope1', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:19.327Z'),
  ('cmvt6dbdu00517kxwld9ww8zw', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c1ua002a7kxw2p5ex3xe', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY.scope2', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:20.610Z'),
  ('cmvt6dccl00537kxw0la489vo', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c2ou002c7kxwoxiwbo03', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY.totalGJ', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:21.861Z'),
  ('cmvt6ddbn00557kxwi4s7725l', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c3m5002e7kxwrmf6s81k', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY.renewableShare', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:23.123Z'),
  ('cmvt6de9z00577kxwp8uw2uvq', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c4ik002g7kxwy6bqh648', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WATER.withdrawal', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:24.359Z'),
  ('cmvt6df6v00597kxwzs5rqjuh', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c5l4002i7kxwr80i2deh', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WATER.recycledShare', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:25.542Z'),
  ('cmvt6dg4q005b7kxw5lxdhd54', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c6fs002k7kxwu89yymnx', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WASTE.hazardous', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:26.762Z'),
  ('cmvt6dhpl005d7kxwqeq1c8h9', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c7bi002m7kxw5v9nb29z', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WASTE.recycledShare', NULL, 'CONSOLIDATED_KPI', NULL, NULL, NULL, NULL, 'APPROVED', 1, '2026-10-29T01:11:28.809Z'),
  ('cmvt6diwh005f7kxwn19v8i95', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c86m002o7kxws1j05zc8', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'CSR.spend', NULL, 'MANUAL', NULL, NULL, NULL, NULL, 'MISSING', 1, '2026-10-29T01:11:30.083Z'),
  ('cmvt6djw3005h7kxwjbz4hurh', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c91v002q7kxwg696orfo', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'GOVERNANCE.cyberIncidents', NULL, 'MANUAL', NULL, NULL, NULL, NULL, 'MISSING', 1, '2026-10-29T01:11:31.636Z'),
  ('cmvt6dkt4005j7kxwkpjrhldy', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6c9xz002s7kxwc849h8n5', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'GOVERNANCE.antiCorruptionTraining', NULL, 'MANUAL', NULL, NULL, NULL, NULL, 'MISSING', 1, '2026-10-29T01:11:32.824Z');

-- Table "public"."BrsrFramework" (1 rows)
INSERT INTO "public"."BrsrFramework" ("id", "name", "version", "reportingYear", "tier", "status", "createdAt") VALUES
  ('cmvt6bfxr000y7kxwu8g3r0oa', 'BRSR', 'v3', 2026, 'CORE', 'ACTIVE', '2026-10-29T01:09:53.200Z');

-- Table "public"."BrsrPrinciple" (9 rows)
INSERT INTO "public"."BrsrPrinciple" ("id", "frameworkId", "code", "name", "title", "description", "sortOrder") VALUES
  ('cmvt6bjib00167kxw7shu4eez', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P1', 'Ethics & Integrity', 'Business conducted ethically, transparently, with integrity', 'Business conducted ethically, transparently, with integrity', 1),
  ('cmvt6bkqe00187kxw509jhwv9', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P2', 'Sustainable Products & Services', 'Goods sustainable, safe, resource efficient', 'Goods sustainable, safe, resource efficient', 2),
  ('cmvt6blm9001a7kxw4o1y9ssk', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P3', 'Employees & Communities', 'Respect & promote employee wellbeing & community development', 'Respect & promote employee wellbeing & community development', 3),
  ('cmvt6bmk3001c7kxwm80e8r4d', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P4', 'Stakeholders', 'Respect, respond to stakeholder interests', 'Respect, respond to stakeholder interests', 4),
  ('cmvt6bnfu001e7kxwy2vgykiv', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P5', 'Human Rights', 'Respect & promote human rights', 'Respect & promote human rights', 5),
  ('cmvt6bobc001g7kxwydafzep2', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P6', 'Environment', 'Respect & make efforts to protect & restore environment', 'Respect & make efforts to protect & restore environment', 6),
  ('cmvt6bp5d001i7kxwcjm9elcd', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P7', 'Public Policy & Advocacy', 'Respect & influence public policy per law', 'Respect & influence public policy per law', 7),
  ('cmvt6bq2u001k7kxwor5lrljq', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P8', 'Inclusive Value Chain', 'Promote inclusive growth & equitable access', 'Promote inclusive growth & equitable access', 8),
  ('cmvt6bqzq001m7kxwx7ke4i8f', 'cmvt6bfxr000y7kxwu8g3r0oa', 'P9', 'Customers & Consumers', 'Engage responsibly with customers & consumers', 'Engage responsibly with customers & consumers', 9);

-- Table "public"."BrsrQuestion" (21 rows)
INSERT INTO "public"."BrsrQuestion" ("id", "frameworkId", "sectionId", "principleId", "questionCode", "questionText", "answerType", "unit", "evidenceRequired", "applicabilityRule", "mappingSource", "calculationMethod", "sortOrder") VALUES
  ('cmvt6brw9001o7kxwqo2ydswe', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bgyf00107kxwt4nqe6k7', NULL, 'A-1', 'CIN of the entity', 'TEXT', NULL, FALSE, NULL, 'SUBSIDIARY.cin', NULL, 1),
  ('cmvt6bsyo001q7kxwi77khlbs', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bgyf00107kxwt4nqe6k7', NULL, 'A-2', 'Name of the listed entity', 'TEXT', NULL, FALSE, NULL, 'SUBSIDIARY.name', NULL, 2),
  ('cmvt6btu8001s7kxw1wckf893', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bgyf00107kxwt4nqe6k7', NULL, 'A-3', 'Total number of employees (permanent + non-permanent)', 'NUMERIC', 'count', FALSE, NULL, 'WORKFORCE.total', NULL, 3),
  ('cmvt6buql001u7kxwe0wmc9el', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bgyf00107kxwt4nqe6k7', NULL, 'A-4', 'Total number of workers', 'NUMERIC', 'count', FALSE, NULL, 'WORKFORCE.workers', NULL, 4),
  ('cmvt6bvmq001w7kxw01lay3sa', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bgyf00107kxwt4nqe6k7', NULL, 'A-5', 'Net turnover (₹ crore)', 'NUMERIC', 'INR crore', FALSE, NULL, 'FINANCIAL.turnover', NULL, 5),
  ('cmvt6bwiq001y7kxwp6a1mw0c', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6blm9001a7kxw4o1y9ssk', 'P3-1', 'Total permanent employees (Male / Female / Other)', 'SOURCE_MAPPED', NULL, FALSE, NULL, 'WORKFORCE.permanent', NULL, 6),
  ('cmvt6bxeq00207kxwctpjo9k4', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6blm9001a7kxw4o1y9ssk', 'P3-2', 'Total non-permanent employees', 'SOURCE_MAPPED', NULL, FALSE, NULL, 'WORKFORCE.nonPermanent', NULL, 7),
  ('cmvt6byb400227kxw4gitkov8', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6blm9001a7kxw4o1y9ssk', 'P3-3', 'Number of fatalities (LTIFR)', 'SOURCE_MAPPED', NULL, TRUE, NULL, 'SAFETY.fatalities', NULL, 8),
  ('cmvt6bz8600247kxw5utjpr3k', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6blm9001a7kxw4o1y9ssk', 'P3-4', 'Lost Time Injury Frequency Rate (LTIFR)', 'NUMERIC', 'per million hours', FALSE, NULL, 'SAFETY.ltifr', 'CALCULATED', 9),
  ('cmvt6c03l00267kxwd1gkuv5y', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6blm9001a7kxw4o1y9ssk', 'P3-5', 'Total training hours (employee)', 'SOURCE_MAPPED', NULL, FALSE, NULL, 'WORKFORCE.trainingHours', NULL, 10),
  ('cmvt6c0z800287kxw0lqbov45', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-1', 'Scope 1 emissions (tCO2e)', 'NUMERIC', 'tCO2e', TRUE, NULL, 'ENERGY.scope1', 'CALCULATED', 11),
  ('cmvt6c1ua002a7kxw2p5ex3xe', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-2', 'Scope 2 emissions (tCO2e)', 'NUMERIC', 'tCO2e', TRUE, NULL, 'ENERGY.scope2', 'CALCULATED', 12),
  ('cmvt6c2ou002c7kxwoxiwbo03', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-3', 'Total energy consumption (GJ)', 'NUMERIC', 'GJ', FALSE, NULL, 'ENERGY.totalGJ', 'CALCULATED', 13),
  ('cmvt6c3m5002e7kxwrmf6s81k', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-4', 'Renewable energy share (%)', 'NUMERIC', '%', FALSE, NULL, 'ENERGY.renewableShare', 'CALCULATED', 14),
  ('cmvt6c4ik002g7kxwy6bqh648', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-5', 'Water withdrawal (KL)', 'SOURCE_MAPPED', 'KL', TRUE, NULL, 'WATER.withdrawal', NULL, 15),
  ('cmvt6c5l4002i7kxwr80i2deh', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-6', 'Water recycled / reused (%)', 'NUMERIC', '%', FALSE, NULL, 'WATER.recycledShare', 'CALCULATED', 16),
  ('cmvt6c6fs002k7kxwu89yymnx', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-7', 'Hazardous waste generated (T)', 'SOURCE_MAPPED', 'T', TRUE, NULL, 'WASTE.hazardous', NULL, 17),
  ('cmvt6c7bi002m7kxw5v9nb29z', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bobc001g7kxwydafzep2', 'P6-8', 'Waste recycled / recovered (%)', 'NUMERIC', '%', FALSE, NULL, 'WASTE.recycledShare', 'CALCULATED', 18),
  ('cmvt6c86m002o7kxws1j05zc8', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bq2u001k7kxwor5lrljq', 'P8-1', 'CSR spend (₹ crore)', 'NUMERIC', 'INR crore', FALSE, NULL, 'CSR.spend', NULL, 19),
  ('cmvt6c91v002q7kxwg696orfo', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bqzq001m7kxwx7ke4i8f', 'P9-1', 'Cybersecurity incidents', 'SOURCE_MAPPED', NULL, FALSE, NULL, 'GOVERNANCE.cyberIncidents', NULL, 20),
  ('cmvt6c9xz002s7kxwc849h8n5', 'cmvt6bfxr000y7kxwu8g3r0oa', 'cmvt6bio100147kxwqydf6ntk', 'cmvt6bjib00167kxw7shu4eez', 'P1-1', 'Anti-corruption training coverage (%)', 'NUMERIC', '%', FALSE, NULL, 'GOVERNANCE.antiCorruptionTraining', NULL, 21);

-- Table "public"."BrsrReport" (1 rows)
INSERT INTO "public"."BrsrReport" ("id", "ref", "title", "financialYear", "framework", "periodStart", "periodEnd", "description", "ownerName", "status", "wizardStep", "scope", "sections", "disclosures", "signoffs", "exports", "version", "versions", "finalizedAt", "createdAt", "updatedAt") VALUES
  ('cmvt58dol00707kss5715gbfb', 'BRSR-FY2526-Consolidated', 'MEIL Group Consolidated BRSR — FY 2025-26', 'FY 2025-26', 'SEBI BRSR Core v1.0', '2026-04-11T22:40:00.000Z', '2027-04-11T23:45:00.000Z', 'Consolidated annual Business Responsibility & Sustainability Report across 7 subsidiaries and 16 Business Units.', 'Group Admin', 'FINALIZED', 8, '{"subsidiaryIds":["cmvt57yuo00007kss94thg3ht","cmvt5803c00067kss8eawwp01","cmvt5802b00047kssx9rm5o3a","cmvt5801900027kssuly4mmhh","cmvt5802h00057kss5vcrhfln","cmvt5801900017kssdbm9g6sp","cmvt5801g00037kssudyfd24t"],"businessUnitIds":["cmvt5810000087kssr4oure2y","cmvt58102000c7kssg4jtvr2x","cmvt58101000a7kss1u47hng4","cmvt58103000e7kssn69xfr3j","cmvt58103000g7ksso98pnla7","cmvt582ba00107ksstpd3cm6s","cmvt58104000k7ksspd0mp75f","cmvt58104000j7kssbn61rt7t","cmvt582bd00127kssruy3ckw5","cmvt582a8000y7kssxl4cy4cw","cmvt5828s000s7kss8j43ho6y","cmvt5827d000m7ksso2iggunp","cmvt5828r000q7kss9l8kynqq","cmvt5829f000w7kss4s9oe6uq","cmvt5828z000u7kssqlf7nnl2","cmvt5827v000o7kssiez5a1cg"],"projectIds":["cmvt5836n00157kssab54g3lw","cmvt5836n00187kssqlx68664","cmvt5836n00167kss0csnb7il","cmvt5836n001a7ksspy772hsr","cmvt5836o001f7ksssq1ngm1s","cmvt5836o001d7kssswxq54mz","cmvt5842v002g7kssxegokowy","cmvt5836o001g7kssiazgj9nf","cmvt583co001y7kssv4sfemdb","cmvt5836o001i7kss5aiva020","cmvt5842y002k7kssuwfpe73x","cmvt5836p001l7ksscmzyzwzc","cmvt584g8002u7kssqq12r756","cmvt5836p001m7kss1sg81ijq","cmvt5842u002e7ksst5ue6prl","cmvt5836p001o7kss0tc3098s","cmvt5842s00227kssdkxf07uj","cmvt5842t00257kss0x11vlwc","cmvt5836p001u7kss3liung3z","cmvt5836p001q7ksspme090vs","cmvt5836p001t7kssxjh733ng","cmvt5836q001w7kssm1wxdsd9","cmvt5843w002s7kssp6sats29","cmvt5842s00207ksspvdt09eh","cmvt5842t00267kss1hu41axe","cmvt5842u00287kssfj1xhipu","cmvt5842u002b7kssxf18hcgj","cmvt5842u002c7kssl8jciq2c","cmvt5842v002i7kssnqny18q2","cmvt5843v002p7kssdoqjzyku","cmvt5843v002o7kssqjomr1hq","cmvt5843v002q7kss3etabcc9"]}', '[{"id":"s1","title":"General Disclosures","content":"Corporate identity: Megha Engineering & Infrastructures Ltd. and 7 Subsidiaries.","sourceRefs":["ORG-MASTER"]},{"id":"s2","title":"Management & Process Disclosures","content":"Group-wide ESG committee and SEBI BRSR alignment.","sourceRefs":["GOV-POLICY"]},{"id":"s3","title":"Environmental Performance","content":"Consolidated performance across 16 Business Units.","sourceRefs":["SUB-2526-001","SUB-2526-002"]},{"id":"s4","title":"Social Performance","content":"Workforce health, safety, and local community outreach.","sourceRefs":["SUB-2526-007"]},{"id":"s5","title":"Governance & Ethics","content":"Zero non-compliance events and green supply chain initiatives.","sourceRefs":["SUB-2526-011"]}]', '[{"code":"BRSR-ENV-01","title":"Total energy consumption (kWh)","mapped":true,"status":"VALIDATED","value":140,"unit":"GWh","note":"Validated against verified site submissions."},{"code":"BRSR-ENV-02","title":"Renewable energy share","mapped":true,"status":"VALIDATED","value":280,"unit":"%","note":"Validated against verified site submissions."},{"code":"BRSR-ENV-03","title":"Energy intensity per rupee of turnover","mapped":true,"status":"VALIDATED","value":420,"unit":"GJ/₹ Cr","note":"Validated against verified site submissions."},{"code":"BRSR-ENV-04","title":"Scope 1 GHG emissions","mapped":true,"status":"VALIDATED","value":560,"unit":"tCO2e","note":"Validated against verified site submissions."},{"code":"BRSR-ENV-05","title":"Scope 2 GHG emissions","mapped":true,"status":"VALIDATED","value":700,"unit":"tCO2e","note":"Validated against verified site submissions."},{"code":"BRSR-ENV-06","title":"Water withdrawal","mapped":true,"status":"VALIDATED","value":840,"unit":"m³","note":"Validated against verified site submissions."},{"code":"BRSR-ENV-07","title":"Water discharge quality","mapped":true,"status":"VALIDATED","value":980,"unit":"mg/L","note":"Validated against verified site submissions."},{"code":"BRSR-ENV-08","title":"Waste generation & disposal","mapped":true,"status":"VALIDATED","value":1120,"unit":"t","note":"Validated against verified site submissions."},{"code":"BRSR-SOC-01","title":"Lost Time Injury Frequency Rate","mapped":true,"status":"VALIDATED","value":1260,"unit":"per mn hrs","note":"Validated against verified site submissions."},{"code":"BRSR-SOC-02","title":"Employee training hours","mapped":true,"status":"VALIDATED","value":1400,"unit":"hrs","note":"Validated against verified site submissions."},{"code":"BRSR-SOC-03","title":"Women in workforce","mapped":true,"status":"VALIDATED","value":1540,"unit":"%","note":"Validated against verified site submissions."},{"code":"BRSR-SOC-04","title":"Employee turnover","mapped":true,"status":"VALIDATED","value":1680,"unit":"%","note":"Validated against verified site submissions."},{"code":"BRSR-SOC-05","title":"CSR beneficiaries","mapped":true,"status":"VALIDATED","value":1820,"unit":"persons","note":"Validated against verified site submissions."},{"code":"BRSR-SOC-06","title":"Contract labour count","mapped":true,"status":"VALIDATED","value":1960,"unit":"persons","note":"Validated against verified site submissions."},{"code":"BRSR-GOV-01","title":"Regulatory non-compliance events","mapped":true,"status":"VALIDATED","value":2100,"unit":"events","note":"Validated against verified site submissions."},{"code":"BRSR-GOV-02","title":"Local sourcing share","mapped":true,"status":"VALIDATED","value":2240,"unit":"%","note":"Validated against verified site submissions."},{"code":"BRSR-GOV-03","title":"Green procurement spend","mapped":true,"status":"VALIDATED","value":2380,"unit":"₹ Cr","note":"Validated against verified site submissions."},{"code":"BRSR-GOV-04","title":"Leadership integrity disclosures","mapped":true,"status":"VALIDATED","value":2520,"unit":"count","note":"Validated against verified site submissions."}]', '[{"role":"Group CFO","name":"R. Srinivasan","decision":"APPROVED","at":"2026-10-19T04:20:00.000Z","comment":"Reviewed consolidated metrics."},{"role":"Group Managing Director","name":"P. Rama Rao","decision":"APPROVED","at":"2026-10-21T03:46:00.000Z","comment":"Approved for SEBI submission."}]', '[{"format":"PDF","at":"2026-10-22T03:59:00.000Z","by":"Group Admin"},{"format":"XLSX","at":"2026-10-22T03:59:00.000Z","by":"Group Admin"}]', 1, '[{"version":1,"at":"2026-10-22T03:59:00.000Z","by":"Group Admin","note":"Finalized consolidated BRSR report."}]', '2026-10-21T22:29:00.000Z', '2026-10-29T00:39:30.694Z', '2026-10-29T00:39:30.694Z');

-- Table "public"."BrsrSection" (3 rows)
INSERT INTO "public"."BrsrSection" ("id", "frameworkId", "code", "name", "description", "sortOrder") VALUES
  ('cmvt6bgyf00107kxwt4nqe6k7', 'cmvt6bfxr000y7kxwu8g3r0oa', 'A', 'General Disclosures', 'Entity identity & business overview', 1),
  ('cmvt6bhsl00127kxwc8lqp7by', 'cmvt6bfxr000y7kxwu8g3r0oa', 'B', 'Management & Process Disclosures', 'Policies, governance, performance', 2),
  ('cmvt6bio100147kxwqydf6ntk', 'cmvt6bfxr000y7kxwu8g3r0oa', 'C', 'Principle-wise Performance', 'Principles 1-9 indicator performance', 3);

-- Table "public"."BusinessUnit" (16 rows)
INSERT INTO "public"."BusinessUnit" ("id", "code", "name", "subsidiaryId", "status", "managerName", "adminName", "description", "createdAt", "updatedAt") VALUES
  ('cmvt58104000k7ksspd0mp75f', 'MTFO', 'Municipal Transit Fleet Operations', 'cmvt5803c00067kss8eawwp01', 'ACTIVE', 'Rohit Verma', 'Jyothi Rao', '', '2026-10-29T00:39:14.260Z', '2026-10-29T00:39:14.260Z'),
  ('cmvt582a8000y7kssxl4cy4cw', 'PDIS', 'PNG Domestic & Industrial Supply', 'cmvt5802b00047kssx9rm5o3a', 'ACTIVE', 'Rajesh Patel', 'Neha Kulkarni', '', '2026-10-29T00:39:14.262Z', '2026-10-29T00:39:14.262Z'),
  ('cmvt58103000e7kssn69xfr3j', 'PTSE', 'Power Transmission & Substation EPC', 'cmvt57yuo00007kss94thg3ht', 'ACTIVE', 'Naveen Kumar', 'Sanjay Gupta', '', '2026-10-29T00:39:14.259Z', '2026-10-29T00:39:14.259Z'),
  ('cmvt58103000g7ksso98pnla7', 'EBMP', 'Electric Bus Manufacturing Plant (Telangana)', 'cmvt5803c00067kss8eawwp01', 'ACTIVE', 'B. Shanker', 'Anita Joshi', '', '2026-10-29T00:39:14.259Z', '2026-10-29T00:39:14.259Z'),
  ('cmvt58104000j7kssbn61rt7t', 'CGDN', 'City Gas Distribution (CGD) Networks', 'cmvt5802b00047kssx9rm5o3a', 'ACTIVE', 'Prasad Patil', 'Rahul Desai', '', '2026-10-29T00:39:14.260Z', '2026-10-29T00:39:14.260Z'),
  ('cmvt58102000c7kssg4jtvr2x', 'HCIT', 'Heavy Civil Infrastructure & Tunnels', 'cmvt57yuo00007kss94thg3ht', 'ACTIVE', 'Manoj Sharma', 'Rekha Pillai', '', '2026-10-29T00:39:14.258Z', '2026-10-29T00:39:14.258Z'),
  ('cmvt5810000087kssr4oure2y', 'IWEN', 'Irrigation & Water Engineering Networks', 'cmvt57yuo00007kss94thg3ht', 'ACTIVE', 'Harish Chandra', 'Gopal Rao', '', '2026-10-29T00:39:14.256Z', '2026-10-29T00:39:14.256Z'),
  ('cmvt58101000a7kss1u47hng4', 'HRP', 'Hydrocarbons, Refinery & Pipelines', 'cmvt57yuo00007kss94thg3ht', 'ACTIVE', 'Suresh Babu', 'Latha Krishnan', '', '2026-10-29T00:39:14.257Z', '2026-10-29T00:39:14.257Z'),
  ('cmvt5827d000m7ksso2iggunp', 'GCDS', 'Geothermal & Clean Drilling Solutions', 'cmvt5801900027kssuly4mmhh', 'ACTIVE', 'Luca Bianchi', 'Farah Khan', '', '2026-10-29T00:39:14.263Z', '2026-10-29T00:39:14.263Z'),
  ('cmvt5827v000o7kssiez5a1cg', 'MPSP', 'Multi-Stage Pumped Storage Projects', 'cmvt5801g00037kssudyfd24t', 'ACTIVE', 'R. K. Sharma', 'Sneha Kulkarni', '', '2026-10-29T00:39:14.266Z', '2026-10-29T00:39:14.266Z'),
  ('cmvt5828r000q7kss9l8kynqq', 'GCOS', 'Global Clean Oilfield Services', 'cmvt5802h00057kss5vcrhfln', 'ACTIVE', 'Carlos Mendez', 'Sofia Morales', '', '2026-10-29T00:39:14.263Z', '2026-10-29T00:39:14.263Z'),
  ('cmvt5828s000s7kss8j43ho6y', 'ARAM', 'Advanced Rig Automation & Manufacturing', 'cmvt5801900027kssuly4mmhh', 'ACTIVE', 'Paolo Martini', 'Arjun Nair', '', '2026-10-29T00:39:14.264Z', '2026-10-29T00:39:14.264Z'),
  ('cmvt5828z000u7kssqlf7nnl2', 'ICFS', 'Industrial Canal-Top & Floating Solar', 'cmvt5801900017kssdbm9g6sp', 'ACTIVE', 'Suresh Varma', 'Tarun Bhatia', '', '2026-10-29T00:39:14.264Z', '2026-10-29T00:39:14.264Z'),
  ('cmvt5829f000w7kss4s9oe6uq', 'CUSP', 'Charanka & Utility-Scale Solar Parks', 'cmvt5801900017kssdbm9g6sp', 'ACTIVE', 'Arvind Mehta', 'Deepa Krishnan', '', '2026-10-29T00:39:14.264Z', '2026-10-29T00:39:14.264Z'),
  ('cmvt582ba00107ksstpd3cm6s', 'EPBI', 'EV Powertrain & Battery Integration Division', 'cmvt5803c00067kss8eawwp01', 'ACTIVE', 'Arvind Swamy', 'Kiran Reddy', '', '2026-10-29T00:39:14.266Z', '2026-10-29T00:39:14.266Z'),
  ('cmvt582bd00127kssruy3ckw5', 'CCDS', 'CNG Compression & Dispensing Stations', 'cmvt5802b00047kssx9rm5o3a', 'ACTIVE', 'Amit Trivedi', 'Swati Shah', '', '2026-10-29T00:39:14.268Z', '2026-10-29T00:39:14.268Z');

-- Table "public"."CalculationResult" (6 rows)
INSERT INTO "public"."CalculationResult" ("id", "recordType", "recordId", "energyRecordId", "waterRecordId", "wasteRecordId", "travelRecordId", "factorId", "factorVersion", "conversionRuleId", "sourceValue", "sourceUnit", "normalizedValue", "normalizedUnit", "calculatedValue", "resultUnit", "scope", "methodologyNote", "calculatedAt") VALUES
  ('cmvt6cgo600357kxwca7zqybh', 'ENERGY', 'cmvt6cbn0002u7kxwnqme7rdj', 'cmvt6cbn0002u7kxwnqme7rdj', NULL, NULL, NULL, 'cmvt6aybl000o7kxwtqfixhq3', 1, NULL, 384000, 'KWH', 1382.4, 'GJ', 274.94, 'tCO2e', 'SCOPE_2', 'Grid factor 0.716 kgCO2e/kWh', '2026-10-29T01:10:40.806Z'),
  ('cmvt6cgo600367kxwf15jf138', 'ENERGY', 'cmvt6cci6002w7kxw4pkw0m8y', 'cmvt6cci6002w7kxw4pkw0m8y', NULL, NULL, NULL, 'cmvt6b04y000p7kxw9wm8r860', 1, NULL, 18650, 'L', 713.2, 'GJ', 49.18, 'tCO2e', 'SCOPE_1', 'Diesel factor 2.637 kgCO2e/L', '2026-10-29T01:10:40.806Z'),
  ('cmvt6cgo600377kxw83emt2y7', 'ENERGY', 'cmvt6cdcj002y7kxwl91xqla1', 'cmvt6cdcj002y7kxwl91xqla1', NULL, NULL, NULL, 'cmvt6b91d000u7kxwup9f65tp', 1, NULL, 510000, 'KWH', 1836, 'GJ', 20.4, 'tCO2e', 'SCOPE_2', 'Solar PPA 0.04 kgCO2e/kWh', '2026-10-29T01:10:40.806Z'),
  ('cmvt6cgo600387kxw9ilfvewn', 'ENERGY', 'cmvt6ce6500307kxw804i1hfn', 'cmvt6ce6500307kxw804i1hfn', NULL, NULL, NULL, 'cmvt6aybl000o7kxwtqfixhq3', 1, NULL, 412000, 'KWH', 1483.2, 'GJ', 294.99, 'tCO2e', 'SCOPE_2', 'Grid factor 0.716 kgCO2e/kWh', '2026-10-29T01:10:40.806Z'),
  ('cmvt6cgo600397kxw8bl2b25h', 'ENERGY', 'cmvt6cez500327kxwmt2f0hlo', 'cmvt6cez500327kxwmt2f0hlo', NULL, NULL, NULL, 'cmvt6b04y000p7kxw9wm8r860', 1, NULL, 17200, 'L', 657.8, 'GJ', 45.36, 'tCO2e', 'SCOPE_1', 'Diesel factor 2.637 kgCO2e/L', '2026-10-29T01:10:40.806Z'),
  ('cmvt6cgo7003a7kxwlln43cft', 'ENERGY', 'cmvt6cftl00347kxwzrs0af1t', 'cmvt6cftl00347kxwzrs0af1t', NULL, NULL, NULL, 'cmvt6aybl000o7kxwtqfixhq3', 1, NULL, 398000, 'KWH', 1432.8, 'GJ', 284.97, 'tCO2e', 'SCOPE_2', 'Grid factor 0.716 kgCO2e/kWh', '2026-10-29T01:10:40.806Z');

-- Table "public"."ConversionRule" (6 rows)
INSERT INTO "public"."ConversionRule" ("id", "fromUnit", "toUnit", "factor", "category", "version", "createdAt") VALUES
  ('cmvt6awk5000i7kxwregw4ey1', 'KWH', 'GJ', 0.0036, 'ENERGY', 1, '2026-10-29T01:09:28.085Z'),
  ('cmvt6awk5000j7kxw8wavh90f', 'MWH', 'KWH', 1000, 'ENERGY', 1, '2026-10-29T01:09:28.085Z'),
  ('cmvt6awk5000k7kxwngq4sulp', 'MWH', 'GJ', 3.6, 'ENERGY', 1, '2026-10-29T01:09:28.085Z'),
  ('cmvt6awk5000l7kxwhfyyf6jj', 'L', 'KL', 0.001, 'VOLUME', 1, '2026-10-29T01:09:28.085Z'),
  ('cmvt6awk5000m7kxwfunifv89', 'M3', 'L', 1000, 'VOLUME', 1, '2026-10-29T01:09:28.085Z'),
  ('cmvt6awk5000n7kxw520veln1', 'KG', 'TON', 0.001, 'MASS', 1, '2026-10-29T01:09:28.085Z');

-- Table "public"."CorrectionRequest" (0 rows)

-- Table "public"."Disclosure" (18 rows)
INSERT INTO "public"."Disclosure" ("id", "code", "section", "title", "required", "unit", "description") VALUES
  ('cmvt58bxt006n7kssbg1tdha7', 'BRSR-SOC-06', 'SOCIAL', 'Contract labour count', TRUE, 'persons', 'Contract workforce engaged.'),
  ('cmvt58bxu006q7kssrao0blzh', 'BRSR-GOV-02', 'GOVERNANCE', 'Local sourcing share', TRUE, '%', 'Procurement from local suppliers.'),
  ('cmvt58bxs006l7ksssoenxq6s', 'BRSR-SOC-03', 'SOCIAL', 'Women in workforce', TRUE, '%', 'Gender diversity ratio.'),
  ('cmvt58bxu006p7kssqvdzwd8q', 'BRSR-GOV-01', 'GOVERNANCE', 'Regulatory non-compliance events', TRUE, 'events', 'Fines/penalties during the period.'),
  ('cmvt58bxv006r7kssx3r8pu5a', 'BRSR-GOV-04', 'GOVERNANCE', 'Leadership integrity disclosures', TRUE, 'count', 'Conflict-of-interest attestations filed.'),
  ('cmvt58bxs006k7kss60sopb56', 'BRSR-SOC-02', 'SOCIAL', 'Employee training hours', TRUE, 'hrs', 'Aggregate training investments.'),
  ('cmvt58bxt006o7kss685v43ou', 'BRSR-ENV-08', 'ENVIRONMENT', 'Waste generation & disposal', TRUE, 't', 'Hazardous and non-hazardous waste.'),
  ('cmvt58bxw006s7kssli46f563', 'BRSR-GOV-03', 'GOVERNANCE', 'Green procurement spend', TRUE, '₹ Cr', 'Spend on certified green suppliers.'),
  ('cmvt58bxp006i7ksstln229bw', 'BRSR-ENV-01', 'ENVIRONMENT', 'Total energy consumption (kWh)', TRUE, 'GWh', 'Aggregate electricity, fuel and other energy sources.'),
  ('cmvt58bxr006j7kssm1813x1i', 'BRSR-ENV-02', 'ENVIRONMENT', 'Renewable energy share', TRUE, '%', 'Share of renewables in total consumption.'),
  ('cmvt58bxs006m7kssnslu4nes', 'BRSR-SOC-04', 'SOCIAL', 'Employee turnover', TRUE, '%', 'Voluntary + involuntary turnover.'),
  ('cmvt58c44006v7kssuejpeq3z', 'BRSR-SOC-01', 'SOCIAL', 'Lost Time Injury Frequency Rate', TRUE, 'per mn hrs', 'Safety performance indicator.'),
  ('cmvt58c44006u7kss5lyjwi9m', 'BRSR-ENV-07', 'ENVIRONMENT', 'Water discharge quality', TRUE, 'mg/L', 'COD/BOD of discharged water.'),
  ('cmvt58c44006w7kssvlx9jv03', 'BRSR-ENV-06', 'ENVIRONMENT', 'Water withdrawal', TRUE, 'm³', 'Total fresh water withdrawal.'),
  ('cmvt58c4j006x7kssh1j1ymu3', 'BRSR-ENV-03', 'ENVIRONMENT', 'Energy intensity per rupee of turnover', TRUE, 'GJ/₹ Cr', 'Energy per unit of turnover.'),
  ('cmvt58c3o006t7kssjf7vxms9', 'BRSR-ENV-04', 'ENVIRONMENT', 'Scope 1 GHG emissions', TRUE, 'tCO2e', 'Direct emissions from owned/controlled sources.'),
  ('cmvt58c4o006y7kssievl4f4h', 'BRSR-SOC-05', 'SOCIAL', 'CSR beneficiaries', TRUE, 'persons', 'Community program reach.'),
  ('cmvt58cs8006z7kss63njjlfn', 'BRSR-ENV-05', 'ENVIRONMENT', 'Scope 2 GHG emissions', TRUE, 'tCO2e', 'Indirect emissions from purchased energy.');

-- Table "public"."EmissionFactor" (10 rows)
INSERT INTO "public"."EmissionFactor" ("id", "name", "category", "source", "fuelType", "geography", "factorValue", "factorUnit", "ch4Factor", "n2oFactor", "scope", "effectiveFrom", "effectiveTo", "version", "methodology", "sourceDocument", "status", "createdAt") VALUES
  ('cmvt6aybl000o7kxwtqfixhq3', 'Grid Electricity (India)', 'ELECTRICITY', 'CEA v19', 'GRID', 'IN', 0.716, 'kgCO2e/kWh', NULL, NULL, 'SCOPE_2', '2025-03-31T18:30:00.000Z', NULL, 1, 'CEA v19', 'CEA CO2 Baseline Database v19', 'ACTIVE', '2026-10-29T01:09:30.369Z'),
  ('cmvt6b04y000p7kxw9wm8r860', 'Diesel (HSD)', 'MOBILE', 'IPCC 2006', 'DIESEL', 'IN', 2.637, 'kgCO2e/L', NULL, NULL, 'SCOPE_1', '2025-03-31T18:30:00.000Z', NULL, 1, 'IPCC 2006', 'IPCC Guidelines 2006 Vol 2 Ch 2', 'ACTIVE', '2026-10-29T01:09:32.722Z'),
  ('cmvt6b1wg000q7kxwpoook6h0', 'Petrol (MS)', 'MOBILE', 'IPCC 2006', 'PETROL', 'IN', 2.296, 'kgCO2e/L', NULL, NULL, 'SCOPE_1', '2025-03-31T18:30:00.000Z', NULL, 1, 'IPCC 2006', 'IPCC Guidelines 2006', 'ACTIVE', '2026-10-29T01:09:35.009Z'),
  ('cmvt6b3mk000r7kxw2ypsf0hm', 'Coal (Sub-bituminous)', 'STATIONARY', 'IPCC 2006', 'COAL', 'IN', 1.9, 'kgCO2e/kg', NULL, NULL, 'SCOPE_1', '2025-03-31T18:30:00.000Z', NULL, 1, 'IPCC 2006', 'IPCC Guidelines 2006 Vol 2 Ch 2', 'ACTIVE', '2026-10-29T01:09:37.244Z'),
  ('cmvt6b5lp000s7kxwqvxvx7gb', 'CNG', 'STATIONARY', 'IPCC 2006', 'CNG', 'IN', 2.19, 'kgCO2e/kg', NULL, NULL, 'SCOPE_1', '2025-03-31T18:30:00.000Z', NULL, 1, 'IPCC 2006', 'IPCC Guidelines 2006', 'ACTIVE', '2026-10-29T01:09:39.805Z'),
  ('cmvt6b7db000t7kxwnkbbzqtp', 'LPG', 'STATIONARY', 'IPCC 2006', 'LPG', 'IN', 2.98, 'kgCO2e/kg', NULL, NULL, 'SCOPE_1', '2025-03-31T18:30:00.000Z', NULL, 1, 'IPCC 2006', 'IPCC Guidelines 2006', 'ACTIVE', '2026-10-29T01:09:42.096Z'),
  ('cmvt6b91d000u7kxwup9f65tp', 'Renewable PPA Solar', 'ELECTRICITY', 'ISAE 3000', 'SOLAR_PPA', 'IN', 0.04, 'kgCO2e/kWh', NULL, NULL, 'SCOPE_2', '2025-03-31T18:30:00.000Z', NULL, 1, 'ISAE 3000', 'RE Procurement Annexure', 'ACTIVE', '2026-10-29T01:09:44.257Z'),
  ('cmvt6bar8000v7kxwz1b0nkns', 'Air Travel (Domestic)', 'TRAVEL', 'GHG Protocol Scope 3', 'AVIATION', 'IN', 0.18, 'kgCO2e/pass-km', NULL, NULL, 'SCOPE_3', '2025-03-31T18:30:00.000Z', NULL, 1, 'GHG Protocol Scope 3', 'GHG Protocol', 'ACTIVE', '2026-10-29T01:09:46.484Z'),
  ('cmvt6bchr000w7kxwy46h22ql', 'Rail Travel', 'TRAVEL', 'GHG Protocol Scope 3', 'RAIL', 'IN', 0.04, 'kgCO2e/pass-km', NULL, NULL, 'SCOPE_3', '2025-03-31T18:30:00.000Z', NULL, 1, 'GHG Protocol Scope 3', 'GHG Protocol', 'ACTIVE', '2026-10-29T01:09:48.735Z'),
  ('cmvt6be8s000x7kxwtb610lqx', 'Road Travel (Car)', 'TRAVEL', 'GHG Protocol Scope 3', 'PETROL', 'IN', 0.11, 'kgCO2e/pass-km', NULL, NULL, 'SCOPE_3', '2025-03-31T18:30:00.000Z', NULL, 1, 'GHG Protocol Scope 3', 'GHG Protocol', 'ACTIVE', '2026-10-29T01:09:51.004Z');

-- Table "public"."EnergyRecord" (19 rows)
INSERT INTO "public"."EnergyRecord" ("id", "projectId", "reportingPeriodId", "module", "source", "sourceCategory", "quantity", "sourceUnit", "normalizedValue", "normalizedUnit", "vendor", "meterRef", "evidenceId", "validationStatus", "calculationStatus", "revisionNumber", "status", "enteredBy", "enteredAt", "updatedBy", "updatedAt") VALUES
  ('cmvt6cdcj002y7kxwl91xqla1', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY', 'Solar PPA', 'RENEWABLE', 510000, 'KWH', 1836, 'GJ', 'MEIL Solar', 'PPA-PVAN-01', NULL, 'PASSED', 'COMPLETED', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:36.498Z', NULL, '2026-10-29T01:10:36.498Z'),
  ('cmvt6ce6500307kxw804i1hfn', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6aee700067kxwsqtxlpql', 'ENERGY', 'Grid Electricity', 'NON_RENEWABLE', 412000, 'KWH', 1483.2, 'GJ', 'BESCOM', 'MTR-PVAN-33kV-01', NULL, 'PASSED', 'COMPLETED', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:37.566Z', NULL, '2026-10-29T01:10:37.566Z'),
  ('cmvt6cez500327kxwmt2f0hlo', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6aee700067kxwsqtxlpql', 'ENERGY', 'Diesel (HSD)', 'NON_RENEWABLE', 17200, 'L', 657.8, 'GJ', 'IOCL', 'DSE-PVAN-01', NULL, 'PASSED', 'COMPLETED', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:38.609Z', NULL, '2026-10-29T01:10:38.609Z'),
  ('cmvt6cftl00347kxwzrs0af1t', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid Electricity', 'NON_RENEWABLE', 398000, 'KWH', 1432.8, 'GJ', 'BESCOM', 'MTR-PVAN-33kV-01', NULL, 'PASSED', 'COMPLETED', 1, 'DRAFT', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:39.705Z', NULL, '2026-10-29T01:10:39.705Z'),
  ('cmvt6cbn0002u7kxwnqme7rdj', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY', 'Grid Electricity', 'NON_RENEWABLE', 384000, 'KWH', 1382.4, 'GJ', 'BESCOM', 'MTR-PVAN-33kV-01', 'cmvt6cols003s7kxwhp79iqgg', 'PASSED', 'COMPLETED', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:34.284Z', NULL, '2026-10-29T01:10:54.680Z'),
  ('cmvt6cci6002w7kxw4pkw0m8y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY', 'Diesel (HSD)', 'NON_RENEWABLE', 18650, 'L', 713.2, 'GJ', 'IOCL', 'DSE-PVAN-01', 'cmvt6cpic003u7kxwylpk30wo', 'PASSED', 'COMPLETED', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:35.406Z', NULL, '2026-10-29T01:10:55.866Z'),
  ('rec-l1-mw29mw0u-pjk3', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity, Renewable electricity, Diesel, Petrol, Gas, LPG, Coal, Other', 'RENEWABLE', 7744168, 'kWh', NULL, NULL, 'Electricity bill, Meter log, Fuel register, Invoice & Delivery Challan, Invoice & Delivery Challan, Invoice & Delivery Challan, Invoice & Delivery Challan, Other', 'MEIL-MTR-GRID-400KV, MEIL-SOLAR-PV-01, MEIL-DG-500KVA-01, MEIL-FLT-PETROL-01, MEIL-GAS-LINE-01, MEIL-LPG-CYL-01, MEIL-BOILER-COAL-01, MEIL-MTR-MISC-01', 'cmw29ixz1000ee9woshb4lr47', 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T09:52:41.697Z', NULL, '2026-11-04T09:52:41.697Z'),
  ('rec-l1-mw29qdxl-hb21', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Er. K. Venkataramana', '2026-11-04T09:55:24.887Z', NULL, '2026-11-04T09:55:24.887Z'),
  ('rec-l1-mw2bz7fs-4e67', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T10:58:15.600Z', NULL, '2026-11-04T10:58:15.600Z'),
  ('rec-l1-mw2dncyl-nbzd', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', 'cmw29ixz1000ee9woshb4lr47', 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T11:45:02.113Z', NULL, '2026-11-04T11:45:02.113Z'),
  ('rec-l1-mw2e899w-lxbw', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T12:01:17.122Z', NULL, '2026-11-04T12:01:17.122Z'),
  ('rec-l1-mw2egzc6-mvp3', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T12:08:04.154Z', NULL, '2026-11-04T12:08:04.154Z'),
  ('rec-l1-mw2f78cj-capk', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T12:28:28.885Z', NULL, '2026-11-04T12:28:28.885Z'),
  ('rec-l1-mw2g62zk-zqtu', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', 'cmw29ixz1000ee9woshb4lr47', 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T12:55:34.886Z', NULL, '2026-11-04T12:55:34.886Z'),
  ('rec-l1-mw2gwgo8-spsx', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T13:16:05.679Z', NULL, '2026-11-04T13:16:05.679Z'),
  ('rec-l1-mw2tkcso-wdhd', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Er. K. Venkataramana', '2026-11-04T19:10:35.809Z', NULL, '2026-11-04T19:10:35.809Z'),
  ('rec-l1-mw2trzud-tr13', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T19:16:32.270Z', NULL, '2026-11-04T19:16:32.270Z'),
  ('rec-l1-mw2ttfof-s0gf', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T19:17:39.437Z', NULL, '2026-11-04T19:17:39.437Z'),
  ('rec-l1-mw2u3qy9-q5xx', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'ENERGY', 'Grid electricity', 'NON_RENEWABLE', 384000, 'kWh', NULL, NULL, 'Electricity bill', 'MEIL-MTR-GRID-400KV', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T19:25:40.621Z', NULL, '2026-11-04T19:25:40.621Z');

-- Table "public"."Evidence" (5 rows)
INSERT INTO "public"."Evidence" ("id", "fileName", "documentType", "documentDate", "reportingPeriodId", "projectId", "module", "sourceRecordId", "uploaderId", "filePath", "fileSize", "mimeType", "hash", "version", "status", "verificationComment", "verifiedBy", "verifiedAt", "createdAt", "updatedAt") VALUES
  ('cmvt6cols003s7kxwhp79iqgg', 'PVAN-Grid-Bill-Apr2026.csv', 'INVOICE', '2026-04-29T18:30:00.000Z', 'cmvt6acpg00047kxwgjmt06r8', 'cmvt5842u002c7kssl8jciq2c', 'ENERGY', 'cmvt6cbn0002u7kxwnqme7rdj', 'cmvt596uj00017k44uqelt2ry', '/evidence-uploads/seed-pvan-grid-bill-apr2026.csv', 284, 'text/csv', 'sha256:seed:grid-bill-apr', 1, 'VERIFIED', NULL, 'cmvt596uj00017k44uqelt2ry', '2026-05-05T18:30:00.000Z', '2026-10-29T01:10:51.088Z', '2026-10-29T01:10:51.088Z'),
  ('cmvt6cpic003u7kxwylpk30wo', 'PVAN-Diesel-Register-Apr2026.csv', 'REGISTER', '2026-04-29T18:30:00.000Z', 'cmvt6acpg00047kxwgjmt06r8', 'cmvt5842u002c7kssl8jciq2c', 'ENERGY', 'cmvt6cci6002w7kxw4pkw0m8y', 'cmvt596uj00017k44uqelt2ry', '/evidence-uploads/seed-pvan-diesel-register-apr2026.csv', 196, 'text/csv', 'sha256:seed:diesel-reg-apr', 1, 'VERIFIED', NULL, 'cmvt596uj00017k44uqelt2ry', '2026-05-05T18:30:00.000Z', '2026-10-29T01:10:52.260Z', '2026-10-29T01:10:52.260Z'),
  ('cmvt6cqfa003w7kxw2nshwv5n', 'PVAN-Water-STP-Apr2026.csv', 'REGISTER', '2026-04-29T18:30:00.000Z', 'cmvt6acpg00047kxwgjmt06r8', 'cmvt5842u002c7kssl8jciq2c', 'WATER', NULL, 'cmvt596uj00017k44uqelt2ry', '/evidence-uploads/seed-pvan-grid-bill-apr2026.csv', 158, 'text/csv', 'sha256:seed:water-stp-apr', 1, 'UNDER_REVIEW', NULL, NULL, NULL, '2026-10-29T01:10:53.446Z', '2026-10-29T01:10:53.446Z'),
  ('cmw29ixz1000ee9woshb4lr47', 'VID 20261026 051852 188.pdf', 'INVOICE', NULL, 'cmvt6ag9q00087kxwvb2pkxhx', 'cmvt5836p001t7kssxjh733ng', 'ENERGY', NULL, 'cmvt596uj00017k44uqelt2ry', '/evidence-uploads/1793805576435-VID_20261026_051852_188.pdf', 32075, 'application/pdf', 'sha256:3ee6604acc0f40e369b8b1ec498a332d170f34f2ec419be2df487363e29b47d8', 1, 'UPLOADED', NULL, NULL, NULL, '2026-11-04T09:49:37.593Z', '2026-11-04T09:49:37.593Z'),
  ('cmw2upavn004y7kggiuqmsppn', 'problem2.jpg', 'INVOICE', NULL, 'cmvt6ag9q00087kxwvb2pkxhx', 'cmvt5842u002c7kssl8jciq2c', 'ENERGY', NULL, 'cmvt596uj00017k44uqelt2ry', '/evidence-uploads/1793841144598-problem2.jpg', 32353, 'image/jpeg', 'sha256:9d960b80494cc35c07e596c0280413c7bae98870c79388dc18cb15f20948bdf2', 1, 'UPLOADED', NULL, NULL, NULL, '2026-11-04T19:42:26.192Z', '2026-11-04T19:42:26.192Z');

-- Table "public"."EvidenceDoc" (45 rows)
INSERT INTO "public"."EvidenceDoc" ("id", "name", "fileType", "sizeKb", "version", "subsidiaryId", "businessUnitId", "projectId", "submissionId", "submissionRef", "disclosureRef", "uploadedBy", "status", "uploadedAt") VALUES
  ('cmvt5gg9m00287kvo7ths7jim', 'meter-log-001.pdf', 'PDF', 157, 2, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', NULL, 'cmvt58801005p7kss9z7gjjny', 'SUB-2526-001', 'BRSR-C2-EMI-02', 'Priya Deshmukh', 'VALID', '2026-10-24T22:08:00.000Z'),
  ('cmvt5gh3v00297kvolk3nruiz', 'calculation-sheet-001.xlsx', 'XLSX', 194, 3, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', NULL, 'cmvt58801005p7kss9z7gjjny', 'SUB-2526-001', 'BRSR-C2-EMI-03', 'Priya Deshmukh', 'VALID', '2026-10-24T22:08:00.000Z'),
  ('cmvt5ghxq002a7kvon9pwbou8', 'meter-log-002.pdf', 'PDF', 231, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt58801005o7ksske537h8m', 'SUB-2526-002', 'BRSR-C2-EMI-04', 'Priya Deshmukh', 'VALID', '2026-10-19T22:03:00.000Z'),
  ('cmvt5girn002b7kvoi7xx3u2p', 'calculation-sheet-002.xlsx', 'XLSX', 268, 2, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt58801005o7ksske537h8m', 'SUB-2526-002', 'BRSR-C2-EMI-05', 'Priya Deshmukh', 'VALID', '2026-10-19T22:03:00.000Z'),
  ('cmvt5gjm4002c7kvojzei9ep4', 'site-photo-002.jpg', 'IMAGE', 305, 3, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt58801005o7ksske537h8m', 'SUB-2526-002', 'BRSR-C2-EMI-06', 'Priya Deshmukh', 'VALID', '2026-10-19T22:03:00.000Z'),
  ('cmvt5gkfo002d7kvou7ffw0le', 'meter-log-003.pdf', 'PDF', 342, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', NULL, 'cmvt58806005u7ksssve227aj', 'SUB-2526-003', 'BRSR-C2-ENE-07', 'Priya Deshmukh', 'VALID', '2026-10-17T22:37:00.000Z'),
  ('cmvt5gl9s002e7kvo5x9h98da', 'calculation-sheet-003.xlsx', 'XLSX', 379, 2, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', NULL, 'cmvt58806005u7ksssve227aj', 'SUB-2526-003', 'BRSR-C2-ENE-08', 'Priya Deshmukh', 'VALID', '2026-10-17T22:37:00.000Z'),
  ('cmvt5gm55002f7kvokt7p4bl0', 'meter-log-004.pdf', 'PDF', 416, 3, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002b7kssxf18hcgj', 'cmvt587zu005a7kssiifgxqia', 'SUB-2526-004', 'BRSR-C2-ENE-09', 'Divya Iyer', 'VALID', '2026-10-26T22:34:00.000Z'),
  ('cmvt5gn44002g7kvo9azf0x7s', 'calculation-sheet-004.xlsx', 'XLSX', 453, 1, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002b7kssxf18hcgj', 'cmvt587zu005a7kssiifgxqia', 'SUB-2526-004', 'BRSR-C2-ENE-01', 'Divya Iyer', 'VALID', '2026-10-26T22:34:00.000Z'),
  ('cmvt5go2v002h7kvo3lx2qqec', 'meter-log-005.pdf', 'PDF', 490, 2, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt58801005n7kssqgm62y4r', 'SUB-2526-005', 'BRSR-C2-WAT-02', 'Priya Deshmukh', 'VALID', '2026-10-14T22:58:00.000Z'),
  ('cmvt5gp3h002i7kvo9y305ih0', 'calculation-sheet-005.xlsx', 'XLSX', 527, 3, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt58801005n7kssqgm62y4r', 'SUB-2526-005', 'BRSR-C2-WAT-03', 'Priya Deshmukh', 'EXPIRED', '2026-10-14T22:58:00.000Z'),
  ('cmvt5gq8d002j7kvol3ulqg1p', 'site-photo-005.jpg', 'IMAGE', 564, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt58801005n7kssqgm62y4r', 'SUB-2526-005', 'BRSR-C2-WAT-04', 'Priya Deshmukh', 'VALID', '2026-10-14T22:58:00.000Z'),
  ('cmvt5gt5a002m7kvoawqbh209', 'meter-log-007.pdf', 'PDF', 675, 1, 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', 'cmvt583co001y7kssv4sfemdb', 'cmvt58804005r7ksseglfnk92', 'SUB-2526-007', 'BRSR-C2-SAF-07', 'Sunita Rao', 'VALID', '2026-10-12T22:32:00.000Z'),
  ('cmvt5gu4h002n7kvo2adt56mo', 'calculation-sheet-007.xlsx', 'XLSX', 712, 2, 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', 'cmvt583co001y7kssv4sfemdb', 'cmvt58804005r7ksseglfnk92', 'SUB-2526-007', 'BRSR-C2-SAF-08', 'Sunita Rao', 'VALID', '2026-10-12T22:32:00.000Z'),
  ('cmvt5gv4b002o7kvox6oqbdtj', 'meter-log-008.pdf', 'PDF', 749, 3, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n00167kss0csnb7il', 'cmvt58803005q7ksspqiaxvnc', 'SUB-2526-008', 'BRSR-C2-WOR-09', 'Priya Deshmukh', 'VALID', '2026-10-25T22:21:00.000Z'),
  ('cmvt5gw2l002p7kvojlj9412z', 'calculation-sheet-008.xlsx', 'XLSX', 786, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n00167kss0csnb7il', 'cmvt58803005q7ksspqiaxvnc', 'SUB-2526-008', 'BRSR-C2-WOR-01', 'Priya Deshmukh', 'VALID', '2026-10-25T22:21:00.000Z'),
  ('cmvt5gx29002q7kvot4runmn7', 'site-photo-008.jpg', 'IMAGE', 823, 2, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n00167kss0csnb7il', 'cmvt58803005q7ksspqiaxvnc', 'SUB-2526-008', 'BRSR-C2-WOR-02', 'Priya Deshmukh', 'VALID', '2026-10-25T22:21:00.000Z'),
  ('cmvt5gy0l002r7kvo2djhij5x', 'meter-log-009.pdf', 'PDF', 860, 3, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n001a7ksspy772hsr', 'cmvt587zy005i7kssynj45zi6', 'SUB-2526-009', 'BRSR-C2-PRO-03', 'Priya Deshmukh', 'VALID', '2026-10-23T22:55:00.000Z'),
  ('cmvt5gyz5002s7kvocpoahzrt', 'calculation-sheet-009.xlsx', 'XLSX', 897, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n001a7ksspy772hsr', 'cmvt587zy005i7kssynj45zi6', 'SUB-2526-009', 'BRSR-C2-PRO-04', 'Priya Deshmukh', 'VALID', '2026-10-23T22:55:00.000Z'),
  ('cmvt5gzyc002t7kvot2rnr9o1', 'meter-log-010.pdf', 'PDF', 934, 2, 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', 'cmvt5842u002e7ksst5ue6prl', 'cmvt58805005s7kssa06zwg9m', 'SUB-2526-010', 'BRSR-C2-CSR-05', 'Kavita Nair', 'EXPIRED', '2026-10-10T22:06:00.000Z'),
  ('cmvt5h0x0002u7kvo9ftyqhwe', 'calculation-sheet-010.xlsx', 'XLSX', 971, 3, 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', 'cmvt5842u002e7ksst5ue6prl', 'cmvt58805005s7kssa06zwg9m', 'SUB-2526-010', 'BRSR-C2-CSR-06', 'Kavita Nair', 'VALID', '2026-10-10T22:06:00.000Z'),
  ('cmvt5h220002v7kvof2xbx2kw', 'meter-log-011.pdf', 'PDF', 1008, 1, 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', 'cmvt5842s00227kssdkxf07uj', 'cmvt58805005t7kssnfw5w036', 'SUB-2526-011', 'BRSR-C2-COM-07', 'Kavita Nair', 'VALID', '2026-10-08T22:40:00.000Z'),
  ('cmvt5h31n002w7kvo73qk5v8b', 'calculation-sheet-011.xlsx', 'XLSX', 1045, 2, 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', 'cmvt5842s00227kssdkxf07uj', 'cmvt58805005t7kssnfw5w036', 'SUB-2526-011', 'BRSR-C2-COM-08', 'Kavita Nair', 'VALID', '2026-10-08T22:40:00.000Z'),
  ('cmvt5h418002x7kvokfotwgpx', 'site-photo-011.jpg', 'IMAGE', 1082, 3, 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', 'cmvt5842s00227kssdkxf07uj', 'cmvt58805005t7kssnfw5w036', 'SUB-2526-011', 'BRSR-C2-COM-09', 'Kavita Nair', 'VALID', '2026-10-08T22:40:00.000Z'),
  ('cmvt5h4zp002y7kvookqwgk1p', 'meter-log-013.pdf', 'PDF', 1119, 1, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, 'cmvt5880b005w7kssie1zhb6u', 'SUB-2526-013', 'BRSR-C2-EMI-01', 'Mei Ling Tan', 'VALID', '2026-10-20T22:16:00.000Z'),
  ('cmvt5h5yz002z7kvoh3ntm0aw', 'calculation-sheet-013.xlsx', 'XLSX', 1156, 2, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, 'cmvt5880b005w7kssie1zhb6u', 'SUB-2526-013', 'BRSR-C2-EMI-02', 'Mei Ling Tan', 'VALID', '2026-10-20T22:16:00.000Z'),
  ('cmvt5h6xp00307kvop4mnec7z', 'meter-log-014.pdf', 'PDF', 1193, 3, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', 'cmvt5842v002i7kssnqny18q2', 'cmvt5880d005z7kssyjh2h2md', 'SUB-2526-014', 'BRSR-C2-WAT-03', 'Divya Iyer', 'VALID', '2026-10-18T22:50:00.000Z'),
  ('cmvt5h7wa00317kvo869qdzzj', 'calculation-sheet-014.xlsx', 'XLSX', 1230, 1, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', 'cmvt5842v002i7kssnqny18q2', 'cmvt5880d005z7kssyjh2h2md', 'SUB-2526-014', 'BRSR-C2-WAT-04', 'Divya Iyer', 'VALID', '2026-10-18T22:50:00.000Z'),
  ('cmvt5h8uj00327kvox9szld7e', 'site-photo-014.jpg', 'IMAGE', 1267, 2, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', 'cmvt5842v002i7kssnqny18q2', 'cmvt5880d005z7kssyjh2h2md', 'SUB-2526-014', 'BRSR-C2-WAT-05', 'Divya Iyer', 'VALID', '2026-10-18T22:50:00.000Z'),
  ('cmvt5h9v400337kvoq5ek3gmp', 'meter-log-015.pdf', 'PDF', 1304, 3, 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', 'cmvt5843v002q7kss3etabcc9', 'cmvt5880d00607kss8y4rwfso', 'SUB-2526-015', 'BRSR-C2-ENE-06', 'Shalini Verma', 'VALID', '2026-10-23T22:55:00.000Z'),
  ('cmvt5hb3j00347kvo1fy965rz', 'calculation-sheet-015.xlsx', 'XLSX', 1341, 1, 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', 'cmvt5843v002q7kss3etabcc9', 'cmvt5880d00607kss8y4rwfso', 'SUB-2526-015', 'BRSR-C2-ENE-07', 'Shalini Verma', 'EXPIRED', '2026-10-23T22:55:00.000Z'),
  ('cmvt5hc4f00357kvopf8y03wb', 'calibration-certificate-q2.pdf (awaited)', 'PDF', 0, 0, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, NULL, '', 'BRSR-C2-EMI-04', '—', 'MISSING', '2026-10-26T22:26:00.000Z'),
  ('cmvt5hd2z00367kvofz4nfy3j', 'waste-manifest-apr-jun.xlsx (awaited)', 'XLSX', 0, 0, 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', NULL, NULL, '', 'BRSR-C2-WAS-02', '—', 'MISSING', '2026-10-27T22:43:00.000Z'),
  ('cmvt5i43x00507kvoxc1jcl79', 'open-access-settlement-q2.xlsx', 'XLSX', 240, 1, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, 'cmvt5hqbb004t7kvobj1a2df3', 'SUB-2526-901', 'BRSR-C2-ENR-03', 'Deepa Krishnan', 'VALID', '2026-10-27T23:43:00.000Z'),
  ('cmvt5iab300517kvobfyiuk7v', 'irec-retirement-statement.pdf', 'PDF', 850, 1, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, 'cmvt5hqbb004t7kvobj1a2df3', 'SUB-2526-901', 'BRSR-C2-ENR-04', 'Deepa Krishnan', 'VALID', '2026-10-27T23:43:00.000Z'),
  ('cmvt5iikd00527kvo8k0oqbnu', 'groundwater-meter-log-q1.csv', 'CSV', 240, 1, 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', NULL, 'cmvt5hree004v7kvo7ez3lvr1', 'SUB-2526-902', 'BRSR-C2-ENR-03', 'Deepa Krishnan', 'VALID', '2026-10-16T23:36:00.000Z'),
  ('cmvt5it1g00537kvohi9fdcrk', 'fuel-consumption-register-q2.xlsx', 'XLSX', 240, 1, 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt5hseu004x7kvot8l3eacr', 'SUB-2526-903', 'BRSR-C2-ENR-03', 'Deepa Krishnan', 'VALID', '2026-10-24T23:52:00.000Z'),
  ('cmvt63dka000e7kj4en6mo6ie', 'cemso-report-bu1001-001.pdf', 'PDF', 482, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001d7kssswxq54mz', 'cmvt632nc00037kj4xf8wyynj', 'SUB-BU-1001-001', 'BRSR-C2-ENR-EM-01', 'Tarun Mehta', 'VALID', '2026-10-28T02:41:00.000Z'),
  ('cmvt63dka000f7kj4sza07diw', 'calibration-bu1001-001.pdf', 'PDF', 218, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001d7kssswxq54mz', 'cmvt632nc00037kj4xf8wyynj', 'SUB-BU-1001-001', 'BRSR-C2-ENR-EM-02', 'Tarun Mehta', 'VALID', '2026-10-28T02:41:00.000Z'),
  ('cmvt63dka000g7kj4axs5gkgm', 'meter-log-bu1001-002.xlsx', 'XLSX', 96, 2, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt634bc00057kj46kasnt5n', 'SUB-BU-1001-002', 'BRSR-C2-WTR-01', 'Tarun Mehta', 'VALID', '2026-10-22T23:06:00.000Z'),
  ('cmvt63dka000h7kj4mgcakmts', 'aux-power-bu1001-004.xlsx', 'XLSX', 124, 2, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt637yg00097kj4529bfm54', 'SUB-BU-1001-004', 'BRSR-C2-ENR-EN-01', 'Tarun Mehta', 'VALID', '2026-10-28T06:41:00.000Z'),
  ('cmvt63dka000i7kj41u1szoc3', 'calibration-bu1001-004.pdf', 'PDF', 198, 1, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt637yg00097kj4529bfm54', 'SUB-BU-1001-004', 'BRSR-C2-ENR-EN-02', 'Tarun Mehta', 'VALID', '2026-10-28T06:41:00.000Z'),
  ('cmvt63dka000j7kj40w90s6li', 'lab-test-bu3002-001.pdf', 'PDF', 312, 1, 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'cmvt5836p001l7ksscmzyzwzc', 'cmvt63atl000b7kj4hpjpbixi', 'SUB-BU-3002-001', 'BRSR-C2-WTR-02', 'Lab Analyst', 'VALID', '2026-10-18T23:50:00.000Z'),
  ('cmvt63dka000k7kj4jg3upo1g', 'log-sheet-bu3002-001.xlsx', 'XLSX', 84, 1, 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'cmvt5836p001l7ksscmzyzwzc', 'cmvt63atl000b7kj4hpjpbixi', 'SUB-BU-3002-001', 'BRSR-C2-WTR-03', 'Lab Analyst', 'VALID', '2026-10-18T23:50:00.000Z'),
  ('cmvt63dka000l7kj48nkh0hym', 'leakage-log-bu3002-002.xlsx', 'XLSX', 76, 1, 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'cmvt5842y002k7kssuwfpe73x', 'cmvt63cm6000d7kj4pa8e6so9', 'SUB-BU-3002-002', 'BRSR-C2-WTR-04', 'Field Engineer', 'VALID', '2026-10-27T02:22:00.000Z');

-- Table "public"."Message" (2 rows)
INSERT INTO "public"."Message" ("id", "kind", "channel", "subject", "body", "audienceLabel", "audienceFilter", "recipients", "delivered", "failed", "readCount", "status", "scheduledFor", "sentBy", "createdAt") VALUES
  ('cmvt58azz006h7ksslnxdqbu0', 'POLICY', 'GROUP_WIDE', 'Updated ESG evidence policy v2.1', 'All submissions across the 16 Business Units must now include calibration certificates for meters.', 'All eligible reporting users', '{}', 31, 31, 0, 22, 'SENT', NULL, 'Group Admin', '2026-10-21T22:29:00.000Z'),
  ('cmvt58azy006g7ksstowq3vhe', 'ANNOUNCEMENT', 'GROUP_WIDE', 'FY 2025-26 BRSR reporting calendar published', 'The consolidated reporting calendar for FY 2025-26 is now available. Q2 data freeze is scheduled in 20 days across all 7 subsidiaries.', 'All eligible reporting users', '{}', 31, 31, 0, 26, 'SENT', NULL, 'Group Admin', '2026-10-24T22:08:00.000Z');

-- Table "public"."Notification" (161 rows)
INSERT INTO "public"."Notification" ("id", "ntype", "title", "body", "severity", "read", "linkView", "refId", "subsidiaryId", "createdAt") VALUES
  ('cmvt58a19006e7kssf337ree0', 'DATA_QUALITY', 'Unit variance check passed', 'All 7 subsidiaries validated against GHG Protocol standards.', 'INFO', TRUE, 'consolidation', '', NULL, '2026-10-25T00:08:00.000Z'),
  ('cmvt58a1a006f7ksss4qqa1m5', 'SYSTEM', 'Automated consolidation run complete', 'Consolidated data engine synced 32 project sites across 16 BUs successfully.', 'INFO', TRUE, 'consolidation', '', NULL, '2026-10-24T01:55:00.000Z'),
  ('cmvt58a17006a7kssqx9z069m', 'APPROVAL', 'Batch approval completed', '5 submissions approved across MEIL Core in the latest review cycle.', 'SUCCESS', FALSE, 'approvals', '', NULL, '2026-10-26T22:34:00.000Z'),
  ('cmvt58a19006d7kssx9k971dr', 'DEADLINE', 'Q2 data freeze in 20 days', 'All 16 Business Units must complete emissions and water disclosures before the freeze.', 'WARNING', TRUE, 'tasks', '', NULL, '2026-10-25T23:21:00.000Z'),
  ('cmvt58a17006b7kssib7u3lrh', 'OVERDUE', '1 submission overdue in Heavy Civil & Tunnels', 'HR / Workforce data collection has crossed its due date.', 'CRITICAL', FALSE, 'submissions', '', NULL, '2026-10-28T21:00:00.000Z'),
  ('cmvt58a18006c7kss7gf230l0', 'SUBMISSION', 'New submission under review', 'Scope 1 — Stationary Combustion Emissions submitted by Ramesh Iyer awaits your review.', 'INFO', FALSE, 'approvals', '', NULL, '2026-10-27T21:47:00.000Z'),
  ('cmvt5he7p00377kvorpq82qmq', 'SUBMISSION', 'New BU report submitted', 'Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.', 'INFO', FALSE, 'monitoring', '', 'cmvt5801900027kssuly4mmhh', '2026-10-27T21:43:00.000Z'),
  ('cmvt5he7p00387kvomdpg9ovp', 'APPROVAL', 'Report approved by Subsidiary Manager', 'Scope 2 — Purchased Electricity was approved by Rajesh Menon.', 'SUCCESS', FALSE, 'monitoring', '', 'cmvt5801900027kssuly4mmhh', '2026-10-26T22:26:00.000Z'),
  ('cmvt5he7p00397kvocpr4n6qh', 'DEADLINE', 'Deadline approaching', 'Kothagudem Thermal Plant site data cut-off is due in 12 days.', 'WARNING', FALSE, 'timelines', '', 'cmvt5801900027kssuly4mmhh', '2026-10-29T00:00:00.000Z'),
  ('cmvt5he7p003a7kvo7tbe2nae', 'OVERDUE', 'Submission overdue', 'Groundwater Drawal (Irrigation BU) crossed its submission deadline.', 'CRITICAL', FALSE, 'submissions', '', 'cmvt5801900027kssuly4mmhh', '2026-10-28T00:43:00.000Z'),
  ('cmvt5he7p003b7kvolx4csr16', 'VALIDATION', 'Validation issue detected', 'Missing evidence: calibration certificate for Scope 1 meter readings.', 'WARNING', FALSE, 'validation', '', 'cmvt5801900027kssuly4mmhh', '2026-10-27T01:26:00.000Z'),
  ('cmvt5he7q003c7kvoyt9io80c', 'PACKAGE', 'Group feedback on reporting package', 'Group Admin requested corrections on the FY 2025-26 reporting package.', 'WARNING', TRUE, 'esg', '', 'cmvt5801900027kssuly4mmhh', '2026-10-26T02:09:00.000Z'),
  ('cmvt5he7q003d7kvoodim6q17', 'EVIDENCE', 'Evidence expired', 'One evidence document in the repository has passed its validity date.', 'WARNING', TRUE, 'evidence', '', 'cmvt5801900027kssuly4mmhh', '2026-10-25T03:52:00.000Z'),
  ('cmvt5he7q003e7kvofe00f0fj', 'SYSTEM', 'Timeline override approved', 'Thermal Generation received an authorized deadline extension (maintenance shutdown).', 'INFO', TRUE, 'timelines', '', 'cmvt5801900027kssuly4mmhh', '2026-10-24T04:35:00.000Z'),
  ('cmvt5hf9n003f7kvo7p71q4ou', 'SUBMISSION', 'New BU report submitted', 'Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.', 'INFO', FALSE, 'monitoring', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-27T21:43:00.000Z'),
  ('cmvt5hf9n003g7kvou8hcti24', 'APPROVAL', 'Report approved by Subsidiary Manager', 'Scope 2 — Purchased Electricity was approved by Rajesh Menon.', 'SUCCESS', FALSE, 'monitoring', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-26T22:26:00.000Z'),
  ('cmvt5hf9n003h7kvop5cxo2z8', 'DEADLINE', 'Deadline approaching', 'Kothagudem Thermal Plant site data cut-off is due in 12 days.', 'WARNING', FALSE, 'timelines', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-29T00:00:00.000Z'),
  ('cmvt5hf9n003i7kvoyjw4d0sd', 'OVERDUE', 'Submission overdue', 'Groundwater Drawal (Irrigation BU) crossed its submission deadline.', 'CRITICAL', FALSE, 'submissions', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-28T00:43:00.000Z'),
  ('cmvt5hf9o003j7kvot7maizxm', 'VALIDATION', 'Validation issue detected', 'Missing evidence: calibration certificate for Scope 1 meter readings.', 'WARNING', FALSE, 'validation', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-27T01:26:00.000Z'),
  ('cmvt5hf9o003k7kvozqdlh6hn', 'PACKAGE', 'Group feedback on reporting package', 'Group Admin requested corrections on the FY 2025-26 reporting package.', 'WARNING', TRUE, 'esg', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-26T02:09:00.000Z'),
  ('cmvt5hf9o003l7kvogziv0nf1', 'EVIDENCE', 'Evidence expired', 'One evidence document in the repository has passed its validity date.', 'WARNING', TRUE, 'evidence', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-25T03:52:00.000Z'),
  ('cmvt5hf9o003m7kvo92bnb9zg', 'SYSTEM', 'Timeline override approved', 'Thermal Generation received an authorized deadline extension (maintenance shutdown).', 'INFO', TRUE, 'timelines', '', 'cmvt5802b00047kssx9rm5o3a', '2026-10-24T04:35:00.000Z'),
  ('cmvt5hgbi003n7kvo0fq9f3gm', 'SUBMISSION', 'New BU report submitted', 'Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.', 'INFO', FALSE, 'monitoring', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-27T21:43:00.000Z'),
  ('cmvt5hgbi003o7kvoxd27q6nb', 'APPROVAL', 'Report approved by Subsidiary Manager', 'Scope 2 — Purchased Electricity was approved by Rajesh Menon.', 'SUCCESS', FALSE, 'monitoring', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-26T22:26:00.000Z'),
  ('cmvt5hgbi003p7kvonyasf44m', 'DEADLINE', 'Deadline approaching', 'Kothagudem Thermal Plant site data cut-off is due in 12 days.', 'WARNING', FALSE, 'timelines', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-29T00:00:00.000Z'),
  ('cmvt5hgbi003q7kvonadqycmn', 'OVERDUE', 'Submission overdue', 'Groundwater Drawal (Irrigation BU) crossed its submission deadline.', 'CRITICAL', FALSE, 'submissions', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-28T00:43:00.000Z'),
  ('cmvt5hgbi003r7kvozyrjdnpu', 'VALIDATION', 'Validation issue detected', 'Missing evidence: calibration certificate for Scope 1 meter readings.', 'WARNING', FALSE, 'validation', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-27T01:26:00.000Z'),
  ('cmvt5hgbi003s7kvoqxlnxw8p', 'PACKAGE', 'Group feedback on reporting package', 'Group Admin requested corrections on the FY 2025-26 reporting package.', 'WARNING', TRUE, 'esg', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-26T02:09:00.000Z'),
  ('cmvt5hgbi003t7kvobf4rxn7u', 'EVIDENCE', 'Evidence expired', 'One evidence document in the repository has passed its validity date.', 'WARNING', TRUE, 'evidence', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-25T03:52:00.000Z'),
  ('cmvt5hgbi003u7kvoehmcmfca', 'SYSTEM', 'Timeline override approved', 'Thermal Generation received an authorized deadline extension (maintenance shutdown).', 'INFO', TRUE, 'timelines', '', 'cmvt57yuo00007kss94thg3ht', '2026-10-24T04:35:00.000Z'),
  ('cmvt5hhch003v7kvo916bb1x0', 'SUBMISSION', 'New BU report submitted', 'Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.', 'INFO', FALSE, 'monitoring', '', 'cmvt5801g00037kssudyfd24t', '2026-10-27T21:43:00.000Z'),
  ('cmvt5hhci003w7kvolpnwyv6v', 'APPROVAL', 'Report approved by Subsidiary Manager', 'Scope 2 — Purchased Electricity was approved by Rajesh Menon.', 'SUCCESS', FALSE, 'monitoring', '', 'cmvt5801g00037kssudyfd24t', '2026-10-26T22:26:00.000Z'),
  ('cmvt5hhci003x7kvotj8i1tl5', 'DEADLINE', 'Deadline approaching', 'Kothagudem Thermal Plant site data cut-off is due in 12 days.', 'WARNING', FALSE, 'timelines', '', 'cmvt5801g00037kssudyfd24t', '2026-10-29T00:00:00.000Z'),
  ('cmvt5hhci003y7kvonervshqv', 'OVERDUE', 'Submission overdue', 'Groundwater Drawal (Irrigation BU) crossed its submission deadline.', 'CRITICAL', FALSE, 'submissions', '', 'cmvt5801g00037kssudyfd24t', '2026-10-28T00:43:00.000Z'),
  ('cmvt5hhci003z7kvoogbo75qc', 'VALIDATION', 'Validation issue detected', 'Missing evidence: calibration certificate for Scope 1 meter readings.', 'WARNING', FALSE, 'validation', '', 'cmvt5801g00037kssudyfd24t', '2026-10-27T01:26:00.000Z'),
  ('cmvt5hhci00407kvovw49i6pk', 'PACKAGE', 'Group feedback on reporting package', 'Group Admin requested corrections on the FY 2025-26 reporting package.', 'WARNING', TRUE, 'esg', '', 'cmvt5801g00037kssudyfd24t', '2026-10-26T02:09:00.000Z'),
  ('cmvt5hhci00417kvo9tyxmc1p', 'EVIDENCE', 'Evidence expired', 'One evidence document in the repository has passed its validity date.', 'WARNING', TRUE, 'evidence', '', 'cmvt5801g00037kssudyfd24t', '2026-10-25T03:52:00.000Z'),
  ('cmvt5hhci00427kvon9fnvbc9', 'SYSTEM', 'Timeline override approved', 'Thermal Generation received an authorized deadline extension (maintenance shutdown).', 'INFO', TRUE, 'timelines', '', 'cmvt5801g00037kssudyfd24t', '2026-10-24T04:35:00.000Z'),
  ('cmvt5hidq00437kvopbbs5hfp', 'SUBMISSION', 'New BU report submitted', 'Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.', 'INFO', FALSE, 'monitoring', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-27T21:43:00.000Z'),
  ('cmvt5hidq00447kvokt32zub9', 'APPROVAL', 'Report approved by Subsidiary Manager', 'Scope 2 — Purchased Electricity was approved by Rajesh Menon.', 'SUCCESS', FALSE, 'monitoring', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-26T22:26:00.000Z'),
  ('cmvt5hidq00457kvod8475zv1', 'DEADLINE', 'Deadline approaching', 'Kothagudem Thermal Plant site data cut-off is due in 12 days.', 'WARNING', FALSE, 'timelines', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-29T00:00:00.000Z'),
  ('cmvt5hidq00467kvo4lh34ft7', 'OVERDUE', 'Submission overdue', 'Groundwater Drawal (Irrigation BU) crossed its submission deadline.', 'CRITICAL', FALSE, 'submissions', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-28T00:43:00.000Z'),
  ('cmvt5hidq00477kvosrilk21l', 'VALIDATION', 'Validation issue detected', 'Missing evidence: calibration certificate for Scope 1 meter readings.', 'WARNING', FALSE, 'validation', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-27T01:26:00.000Z'),
  ('cmvt5hidr00487kvo8cknwie4', 'PACKAGE', 'Group feedback on reporting package', 'Group Admin requested corrections on the FY 2025-26 reporting package.', 'WARNING', TRUE, 'esg', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-26T02:09:00.000Z'),
  ('cmvt5hidr00497kvo0hkpklwb', 'EVIDENCE', 'Evidence expired', 'One evidence document in the repository has passed its validity date.', 'WARNING', TRUE, 'evidence', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-25T03:52:00.000Z'),
  ('cmvt5hidr004a7kvofxg89543', 'SYSTEM', 'Timeline override approved', 'Thermal Generation received an authorized deadline extension (maintenance shutdown).', 'INFO', TRUE, 'timelines', '', 'cmvt5801900017kssdbm9g6sp', '2026-10-24T04:35:00.000Z'),
  ('cmvt5hjej004b7kvoqvcdgv4c', 'SUBMISSION', 'New BU report submitted', 'Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.', 'INFO', FALSE, 'monitoring', '', 'cmvt5803c00067kss8eawwp01', '2026-10-27T21:43:00.000Z'),
  ('cmvt5hjej004c7kvovj2wbpiw', 'APPROVAL', 'Report approved by Subsidiary Manager', 'Scope 2 — Purchased Electricity was approved by Rajesh Menon.', 'SUCCESS', FALSE, 'monitoring', '', 'cmvt5803c00067kss8eawwp01', '2026-10-26T22:26:00.000Z'),
  ('cmvt5hjej004d7kvoler2xfil', 'DEADLINE', 'Deadline approaching', 'Kothagudem Thermal Plant site data cut-off is due in 12 days.', 'WARNING', FALSE, 'timelines', '', 'cmvt5803c00067kss8eawwp01', '2026-10-29T00:00:00.000Z'),
  ('cmvt5hjej004e7kvo2m8ymzjh', 'OVERDUE', 'Submission overdue', 'Groundwater Drawal (Irrigation BU) crossed its submission deadline.', 'CRITICAL', FALSE, 'submissions', '', 'cmvt5803c00067kss8eawwp01', '2026-10-28T00:43:00.000Z');
INSERT INTO "public"."Notification" ("id", "ntype", "title", "body", "severity", "read", "linkView", "refId", "subsidiaryId", "createdAt") VALUES
  ('cmvt5hjej004f7kvo0p9y4khd', 'VALIDATION', 'Validation issue detected', 'Missing evidence: calibration certificate for Scope 1 meter readings.', 'WARNING', FALSE, 'validation', '', 'cmvt5803c00067kss8eawwp01', '2026-10-27T01:26:00.000Z'),
  ('cmvt5hjej004g7kvoybq9of84', 'PACKAGE', 'Group feedback on reporting package', 'Group Admin requested corrections on the FY 2025-26 reporting package.', 'WARNING', TRUE, 'esg', '', 'cmvt5803c00067kss8eawwp01', '2026-10-26T02:09:00.000Z'),
  ('cmvt5hjej004h7kvog7ybm64m', 'EVIDENCE', 'Evidence expired', 'One evidence document in the repository has passed its validity date.', 'WARNING', TRUE, 'evidence', '', 'cmvt5803c00067kss8eawwp01', '2026-10-25T03:52:00.000Z'),
  ('cmvt5hjej004i7kvo8tr9s0ai', 'SYSTEM', 'Timeline override approved', 'Thermal Generation received an authorized deadline extension (maintenance shutdown).', 'INFO', TRUE, 'timelines', '', 'cmvt5803c00067kss8eawwp01', '2026-10-24T04:35:00.000Z'),
  ('cmvt5hkf7004j7kvoaamnz68l', 'SUBMISSION', 'New BU report submitted', 'Renewable Energy Share — Solar was submitted by Deepa Krishnan and is awaiting Subsidiary Manager review.', 'INFO', FALSE, 'monitoring', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-27T21:43:00.000Z'),
  ('cmvt5hkf8004k7kvoww8d3pkp', 'APPROVAL', 'Report approved by Subsidiary Manager', 'Scope 2 — Purchased Electricity was approved by Rajesh Menon.', 'SUCCESS', FALSE, 'monitoring', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-26T22:26:00.000Z'),
  ('cmvt5hkf8004l7kvoixue6s3z', 'DEADLINE', 'Deadline approaching', 'Kothagudem Thermal Plant site data cut-off is due in 12 days.', 'WARNING', FALSE, 'timelines', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-29T00:00:00.000Z'),
  ('cmvt5hkf8004m7kvoi451emz4', 'OVERDUE', 'Submission overdue', 'Groundwater Drawal (Irrigation BU) crossed its submission deadline.', 'CRITICAL', FALSE, 'submissions', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-28T00:43:00.000Z'),
  ('cmvt5hkf8004n7kvo5czt5ii4', 'VALIDATION', 'Validation issue detected', 'Missing evidence: calibration certificate for Scope 1 meter readings.', 'WARNING', FALSE, 'validation', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-27T01:26:00.000Z'),
  ('cmvt5hkf8004o7kvoof8aucwv', 'PACKAGE', 'Group feedback on reporting package', 'Group Admin requested corrections on the FY 2025-26 reporting package.', 'WARNING', TRUE, 'esg', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-26T02:09:00.000Z'),
  ('cmvt5hkf8004p7kvovl41euoe', 'EVIDENCE', 'Evidence expired', 'One evidence document in the repository has passed its validity date.', 'WARNING', TRUE, 'evidence', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-25T03:52:00.000Z'),
  ('cmvt5hkf8004q7kvoqi9dtmga', 'SYSTEM', 'Timeline override approved', 'Thermal Generation received an authorized deadline extension (maintenance shutdown).', 'INFO', TRUE, 'timelines', '', 'cmvt5802h00057kss5vcrhfln', '2026-10-24T04:35:00.000Z'),
  ('cmvt5hlga004r7kvo2n8nxxpa', 'SYSTEM', 'Group Admin announcement', 'BRSR Core disclosure catalogue v1.2 is now mandatory for FY 2025-26 subsidiary packages.', 'INFO', FALSE, 'esg', '', NULL, '2026-10-23T00:18:00.000Z'),
  ('cmvt5iu1700547kvoy1gciuhb', 'SUBMISSION', 'Corrected report resubmitted', 'Scope 2 — Purchased Electricity (Renewables) was resubmitted by Deepa Krishnan after corrections and is awaiting your review.', 'INFO', FALSE, 'queue', '', 'cmvt5801900027kssuly4mmhh', '2026-10-28T00:43:00.000Z'),
  ('cmvt63fca000q7kj4zkapcka3', 'BU_DEMO', 'BU review queue — 3 reports awaiting decision', 'Three Thermal BU reports are awaiting your review: SUB-BU-1001-001, SUB-BU-1001-002 (overdue), SUB-BU-1001-003 (missing evidence).', 'WARNING', FALSE, 'queue', 'cmvt634bc00057kj46kasnt5n', NULL, '2026-10-28T07:41:00.000Z'),
  ('cmvt63gaf000r7kj4u7fpxlgt', 'BU_DEMO', 'Resubmission received — Auxiliary Power', 'SUB-BU-1001-004 was resubmitted by Tarun Mehta after the corrections you requested. Please re-review.', 'INFO', FALSE, 'queue', 'cmvt637yg00097kj4529bfm54', NULL, '2026-10-28T06:41:00.000Z'),
  ('cmvzfl3g3000ue9jwjpxjd0zr', 'APPROVAL', 'Submission Approved by Project Admin', 'Project Admin Project Site Admin approved your data submission for Zojila Strategic Bi-Directional Tunnel.', 'SUCCESS', FALSE, 'submissions', 'cmvt58806005u7ksssve227aj', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T10:15:57.171Z'),
  ('cmvzflgmv000ye9jw4i45697x', 'DEADLINE', 'Correction Requested by Project Admin', 'Notes: "Automated verification test: Please upload calibration certificate for water flow meter."', 'WARNING', FALSE, 'corrections', 'cmvt587zy005i7kssynj45zi6', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T10:16:14.263Z'),
  ('cmvzflswd0012e9jw68b026hl', 'SUBMISSION', 'New Project Report Submitted: Zojila Strategic Bi-Directional Tunnel', 'Project Admin Project Site Admin has submitted the Consolidated ESG Project Report for Zojila Strategic Bi-Directional Tunnel (PRJ-ZOJ) for your review and approval.', 'INFO', FALSE, 'submissions', 'cmvzflrsn0011e9jwf5v5ans6', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T10:16:30.154Z'),
  ('cmvzh9037001de9jwzj2rlq1z', 'APPROVAL', 'Submission Approved by Project Admin', 'Project Admin Project Site Admin approved your data submission for Zojila Strategic Bi-Directional Tunnel.', 'SUCCESS', FALSE, 'submissions', 'cmvt587zy005i7kssynj45zi6', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T11:02:32.174Z'),
  ('cmvzh947i001he9jwx45efcc4', 'DEADLINE', 'Correction Requested by Project Admin', 'Notes: "Lab test report missing calibration stamp."', 'WARNING', FALSE, 'corrections', 'cmvt587zy005i7kssynj45zi6', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T11:02:37.519Z'),
  ('cmvzh9frq001ne9jwz3kqadzu', 'SUBMISSION', 'New Project Report Submitted: Zojila Strategic Bi-Directional Tunnel', 'Project Admin Project Site Admin has submitted the Consolidated ESG Project Report for Zojila Strategic Bi-Directional Tunnel (PRJ-ZOJ) for your review and approval.', 'INFO', FALSE, 'submissions', 'cmvzh9es3001me9jwnu1bqoa1', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T11:02:52.502Z'),
  ('cmvzha8d6001re9jwgwviiaza', 'TASK_ASSIGNED', 'New ESG Task Assigned', 'You have been assigned task ''Submit Q4 Scope 1 Genset Fuel Vouchers'' by Project Admin Project Site Admin. Deadline: 28/3/2026.', 'INFO', FALSE, 'tasks', 'cmvt5869900467ksshlt6lz2z', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T11:03:29.563Z'),
  ('cmvzhhg3k001ue9jwjo8see0f', 'APPROVAL', 'Submission Approved by Project Admin', 'Project Admin Project Site Admin approved your data submission for Zojila Strategic Bi-Directional Tunnel.', 'SUCCESS', FALSE, 'submissions', 'cmvt587zy005i7kssynj45zi6', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T11:09:06.176Z'),
  ('cmvziif8e001ye9jwte2lhkuo', 'SUBMISSION', 'New Project Report Submitted: Zojila Strategic Bi-Directional Tunnel', 'Project Admin Project Site Admin has submitted the Consolidated ESG Project Report for Zojila Strategic Bi-Directional Tunnel (PRJ-ZOJ) for your review and approval.', 'INFO', FALSE, 'submissions', 'cmvziiegj001xe9jwz36t6qt8', 'cmvt57yuo00007kss94thg3ht', '2026-11-02T11:37:51.327Z'),
  ('cmw2994dy0002e9ngnq6e6c8w', 'APPROVAL', 'Submission Approved: Site Solar & Auxiliary Energy Data — April 2026', 'Project Admin Project Site Admin approved your submission. Note: "Reconciled with generation logbook and approved by Er. K. Venkataramana"', 'SUCCESS', FALSE, 'submissions', 'cmvt586at004m7kssfdznrms4', 'cmvt57yuo00007kss94thg3ht', '2026-11-04T09:41:59.351Z'),
  ('cmw29a3av0002e90o0guhewji', 'APPROVAL', 'Submission Approved: Site Solar & Auxiliary Energy Data — April 2026', 'Project Admin Project Site Admin approved your submission. Note: "Reconciled with generation logbook and approved by Er. K. Venkataramana"', 'SUCCESS', FALSE, 'submissions', 'cmvt586at004m7kssfdznrms4', 'cmvt57yuo00007kss94thg3ht', '2026-11-04T09:42:44.600Z'),
  ('cmw29eibn0008e9wouebgqmpg', 'APPROVAL', 'Submission Approved: Site Solar & Auxiliary Energy Data — April 2026', 'Project Admin Project Site Admin approved your submission for Zojila Strategic Bi-Directional Tunnel. Note: "Verified and approved via E2E test"', 'SUCCESS', FALSE, 'submissions', 'cmvt586at004m7kssfdznrms4', 'cmvt57yuo00007kss94thg3ht', '2026-11-04T09:46:10.688Z'),
  ('cmw29nadb000pe9wo8ozi6s0h', 'SUBMISSION', 'Project site data received: PU-cmw29mzly000ie9wovwaawe4s', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw29mzly000ie9wovwaawe4s', 'cmvt5801900027kssuly4mmhh', '2026-11-04T09:53:00.287Z'),
  ('cmw29nb2x000qe9wot6ib6krk', 'SUBMISSION', 'Sent for review: PU-cmw29mzly000ie9wovwaawe4s', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the BU/Subsidiary review chain. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw29mzly000ie9wovwaawe4s', NULL, '2026-11-04T09:53:01.210Z'),
  ('cmw29o77k0011e9woi8qa1fo7', 'SUBMISSION', 'Project site data received: PU-cmw29no6s000se9woi4mz4ejy', 'Project — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw29no6s000se9woi4mz4ejy', 'cmvt5801900027kssuly4mmhh', '2026-11-04T09:53:42.848Z'),
  ('cmw29o7xi0012e9wo1bk6kter', 'SUBMISSION', 'Sent for review: PU-cmw29no6s000se9woi4mz4ejy', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the BU/Subsidiary review chain. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw29no6s000se9woi4mz4ejy', NULL, '2026-11-04T09:53:43.782Z'),
  ('cmw29qsw6001de9wou8y3aps9', 'SUBMISSION', 'Project site data received: PU-cmw29qhbi0016e9wo8tcmoxp8', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Er. K. Venkataramana (PROJECT_ADMIN) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw29qhbi0016e9wo8tcmoxp8', 'cmvt5801900027kssuly4mmhh', '2026-11-04T09:55:44.263Z'),
  ('cmw29qtvh001ee9woxfuxcmhu', 'SUBMISSION', 'Sent for review: PU-cmw29qhbi0016e9wo8tcmoxp8', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the BU/Subsidiary review chain. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw29qhbi0016e9wo8tcmoxp8', NULL, '2026-11-04T09:55:45.533Z'),
  ('cmw29rzq9001pe9woac4avcpx', 'SUBMISSION', 'Project site data received: PU-cmw29rhe5001ge9wo5yykjkdc', 'Project — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Er. K. Venkataramana (PROJECT_ADMIN) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw29rhe5001ge9wo5yykjkdc', 'cmvt5801900027kssuly4mmhh', '2026-11-04T09:56:39.777Z'),
  ('cmw29s1fh001qe9wop6j73aca', 'SUBMISSION', 'Sent for review: PU-cmw29rhe5001ge9wo5yykjkdc', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the BU/Subsidiary review chain. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw29rhe5001ge9wo5yykjkdc', NULL, '2026-11-04T09:56:41.982Z'),
  ('cmw2b06ru002de9wo7g3926cc', 'SUBMISSION', 'Project site data received: PU-cmw2azuyd0026e9wo56uimwjc', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2azuyd0026e9wo56uimwjc', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T10:31:01.770Z'),
  ('cmw2b07pr002ee9wo7td9hqm7', 'SUBMISSION', 'Sent for review: PU-cmw2azuyd0026e9wo56uimwjc', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2azuyd0026e9wo56uimwjc', NULL, '2026-11-04T10:31:02.991Z'),
  ('cmw2b0vz7002pe9wov9c7ttwl', 'SUBMISSION', 'Project site data received: PU-cmw2b0m0a002ie9wogv9b3480', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2b0m0a002ie9wogv9b3480', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T10:31:34.435Z'),
  ('cmw2b0x8v002qe9wohfzrlex5', 'SUBMISSION', 'Sent for review: PU-cmw2b0m0a002ie9wogv9b3480', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2b0m0a002ie9wogv9b3480', NULL, '2026-11-04T10:31:36.079Z'),
  ('cmw2b42ao0037e9wo7rei43oy', 'SUBMISSION', 'Project site data received: PU-cmw2b3pd40030e9wof2blenck', 'Kakinada Rig Assembly & Testing Yard — Level 1 — Energy Consumption (April 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · Kakinada Rig Assembly & Testing Yard.', 'INFO', FALSE, 'submissions', 'cmw2b3pd40030e9wof2blenck', 'cmvt5801900027kssuly4mmhh', '2026-11-04T10:34:02.592Z'),
  ('cmw2b486h0038e9woorsa13kt', 'SUBMISSION', 'Sent for review: PU-cmw2b3pd40030e9wof2blenck', 'Your ENERGY data for Kakinada Rig Assembly & Testing Yard has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2b3pd40030e9wof2blenck', NULL, '2026-11-04T10:34:08.999Z'),
  ('cmw2b88rv003he9wouwwrkbxj', 'APPROVAL', 'Submission Approved: Kakinada Rig Assembly & Testing Yard — Level 1 — Energy Consumption (April 2026)', 'Project Admin Er. K. Venkataramana approved your submission for HH-300 Automated Hydraulic Rigs Line. Note: "Verified and approved by Project Admin Er. K. Venkataramana"', 'SUCCESS', FALSE, 'submissions', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900027kssuly4mmhh', '2026-11-04T10:37:17.612Z'),
  ('cmw2bzj2n003we9wo1majysag', 'SUBMISSION', 'Project site data received: PU-cmw2bz902003pe9woj09b1z3y', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2bz902003pe9woj09b1z3y', 'cmvt5801900027kssuly4mmhh', '2026-11-04T10:58:30.672Z'),
  ('cmw2bzjwb003ze9wouqzblj6n', 'SUBMISSION', 'Sent for review: PU-cmw2bz902003pe9woj09b1z3y', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2bz902003pe9woj09b1z3y', NULL, '2026-11-04T10:58:31.739Z'),
  ('cmw2bzzp70048e9wo4eks50f9', 'SUBMISSION', 'Project site data received: PU-cmw2bzjcu003ye9wodl8r6lvz', 'Project — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2bzjcu003ye9wodl8r6lvz', 'cmvt5801900027kssuly4mmhh', '2026-11-04T10:58:52.220Z'),
  ('cmw2c00x90049e9wogtnaxl00', 'SUBMISSION', 'Sent for review: PU-cmw2bzjcu003ye9wodl8r6lvz', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2bzjcu003ye9wodl8r6lvz', NULL, '2026-11-04T10:58:53.805Z'),
  ('cmw2de0es0050e9wo5tlau52l', 'SUBMISSION', 'Full Site ESG Package Submitted: Kakinada Rig Assembly & Testing Yard', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Kakinada Rig Assembly & Testing Yard (April 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2ddzhr004ve9womqlso1he', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:37:45.754Z'),
  ('cmw2df24s0057e9wojv5rpzrz', 'SUBMISSION', 'Full Site ESG Package Submitted: Kakinada Rig Assembly & Testing Yard', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Kakinada Rig Assembly & Testing Yard (April 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2ddzhr004ve9womqlso1he', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:38:34.828Z'),
  ('cmw2dmerq005ce9wo638cv1yi', 'APPROVAL', 'Submission Approved: Kakinada Rig Assembly & Testing Yard — Complete Site ESG Disclosure Package (April 2026)', 'Project Admin Er. K. Venkataramana approved your data submission for HH-300 Automated Hydraulic Rigs Line.', 'SUCCESS', FALSE, 'submissions', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:44:17.798Z');
INSERT INTO "public"."Notification" ("id", "ntype", "title", "body", "severity", "read", "linkView", "refId", "subsidiaryId", "createdAt") VALUES
  ('cmw2dnnwy005pe9woxpv9jado', 'SUBMISSION', 'Project site data received: PU-cmw2dnelx005ie9wo3l8gpzhe', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2dnelx005ie9wo3l8gpzhe', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:45:16.306Z'),
  ('cmw2dnoqa005qe9wovle0xd05', 'SUBMISSION', 'Sent for review: PU-cmw2dnelx005ie9wo3l8gpzhe', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2dnelx005ie9wo3l8gpzhe', NULL, '2026-11-04T11:45:17.363Z'),
  ('cmw2doa1v0061e9wobu9uscp0', 'SUBMISSION', 'Project site data received: PU-cmw2dns7e005se9wo5c830bwd', 'Project — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2dns7e005se9wo5c830bwd', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:45:44.995Z'),
  ('cmw2dobcg0062e9wowy9q72kc', 'SUBMISSION', 'Sent for review: PU-cmw2dns7e005se9wo5c830bwd', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2dns7e005se9wo5c830bwd', NULL, '2026-11-04T11:45:46.484Z'),
  ('cmw2dp7xz006de9wos5xbarl4', 'SUBMISSION', 'Project site data received: PU-cmw2dotyg0064e9womt3d1upm', 'Project — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2dotyg0064e9womt3d1upm', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:46:28.919Z'),
  ('cmw2dp8oz006ee9woxrisfj41', 'SUBMISSION', 'Sent for review: PU-cmw2dotyg0064e9womt3d1upm', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2dotyg0064e9womt3d1upm', NULL, '2026-11-04T11:46:29.892Z'),
  ('cmw2dr662006pe9wodgp7alwf', 'SUBMISSION', 'Project site data received: PU-cmw2dqxpb006ge9woeof9pfn2', 'HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2dqxpb006ge9woeof9pfn2', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:47:59.930Z'),
  ('cmw2dr736006se9wow4ygn61z', 'SUBMISSION', 'Sent for review: PU-cmw2dqxpb006ge9woeof9pfn2', 'Your WATER data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2dqxpb006ge9woeof9pfn2', NULL, '2026-11-04T11:48:01.122Z'),
  ('cmw2drlaz006ze9woq764d2i4', 'SUBMISSION', 'Project site data received: PU-cmw2dr4n7006ne9woeykdmzzq', 'Project — Level 2 — Water Management (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2dr4n7006ne9woeykdmzzq', 'cmvt5801900027kssuly4mmhh', '2026-11-04T11:48:19.548Z'),
  ('cmw2drm7i0070e9wo8hqv6b97', 'SUBMISSION', 'Sent for review: PU-cmw2dr4n7006ne9woeykdmzzq', 'Your WATER data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2dr4n7006ne9woeykdmzzq', NULL, '2026-11-04T11:48:20.718Z'),
  ('cmw2dsxby0071e9wod5kuyuhw', 'APPROVAL', 'Submission Approved: Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'Project Admin Rohit Kumar approved your data submission for Pavagada Mega Solar Complex Expansion.', 'SUCCESS', FALSE, 'submissions', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T11:49:21.791Z'),
  ('cmw2dszjw0074e9wo3cur1h7m', 'APPROVAL', 'Submission Approved: Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'Project Admin Rohit Kumar approved your data submission for Pavagada Mega Solar Complex Expansion.', 'SUCCESS', FALSE, 'submissions', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T11:49:24.669Z'),
  ('cmw2e8i35000g7ktwe18bbxjj', 'SUBMISSION', 'Project site data received: PU-cmw2e8awm00097ktw9iiiwgl9', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2e8awm00097ktw9iiiwgl9', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T12:01:28.529Z'),
  ('cmw2e8iww000h7ktw5tcp5dur', 'SUBMISSION', 'Sent for review: PU-cmw2e8awm00097ktw9iiiwgl9', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2e8awm00097ktw9iiiwgl9', NULL, '2026-11-04T12:01:29.600Z'),
  ('cmw2eh91y000a7kggrkdlknea', 'SUBMISSION', 'Project site data received: PU-cmw2eh1aq00037kggbe6w0yqw', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2eh1aq00037kggbe6w0yqw', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T12:08:16.726Z'),
  ('cmw2eh9zt000b7kggeuq24g5i', 'SUBMISSION', 'Sent for review: PU-cmw2eh1aq00037kggbe6w0yqw', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2eh1aq00037kggbe6w0yqw', NULL, '2026-11-04T12:08:17.945Z'),
  ('cmw2f7hxj000k7kggxz957lu5', 'SUBMISSION', 'Project site data received: PU-cmw2f7a9t000d7kggf57ezatm', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2f7a9t000d7kggf57ezatm', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T12:28:41.287Z'),
  ('cmw2f7ioy000l7kgg67flg1vr', 'SUBMISSION', 'Sent for review: PU-cmw2f7a9t000d7kggf57ezatm', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2f7a9t000d7kggf57ezatm', NULL, '2026-11-04T12:28:42.274Z'),
  ('cmw2f80qo000w7kgg3gb55hk5', 'SUBMISSION', 'Project site data received: PU-cmw2f7lny000n7kggnesw78ox', 'Project — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2f7lny000n7kggnesw78ox', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T12:29:05.664Z'),
  ('cmw2f81kx000x7kggkt0y68by', 'SUBMISSION', 'Sent for review: PU-cmw2f7lny000n7kggnesw78ox', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2f7lny000n7kggnesw78ox', NULL, '2026-11-04T12:29:06.753Z'),
  ('cmw2fs8vr0083e9woeoeli83r', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T12:44:49.335Z'),
  ('cmw2ft9xc008ae9wod12uvhvg', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T12:45:37.345Z'),
  ('cmw2fvvjv008ke9wor5colf2p', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T12:47:38.683Z'),
  ('cmw2g6e4o0098e9wol1sjpyrz', 'SUBMISSION', 'Project site data received: PU-cmw2g658j0091e9wo140rnqhl', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2g658j0091e9wo140rnqhl', 'cmvt5801900027kssuly4mmhh', '2026-11-04T12:55:49.321Z'),
  ('cmw2g6eyw0099e9wog2qz1s8r', 'SUBMISSION', 'Sent for review: PU-cmw2g658j0091e9wo140rnqhl', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2g658j0091e9wo140rnqhl', NULL, '2026-11-04T12:55:50.408Z'),
  ('cmw2g6uts009ie9wo9ruqsidl', 'SUBMISSION', 'Project site data received: PU-cmw2g6ll0009be9wob6zi3c7x', 'HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2g6ll0009be9wob6zi3c7x', 'cmvt5801900027kssuly4mmhh', '2026-11-04T12:56:10.960Z'),
  ('cmw2g6vz4009je9wo86t2s86e', 'SUBMISSION', 'Sent for review: PU-cmw2g6ll0009be9wob6zi3c7x', 'Your WATER data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2g6ll0009be9wob6zi3c7x', NULL, '2026-11-04T12:56:12.448Z'),
  ('cmw2gwsnd00a0e9wo387mnyag', 'SUBMISSION', 'Project site data received: PU-cmw2gwiom009te9wopvdyyjhz', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2gwiom009te9wopvdyyjhz', 'cmvt5801900027kssuly4mmhh', '2026-11-04T13:16:21.194Z'),
  ('cmw2gwtof00a1e9wowgjzk3j1', 'SUBMISSION', 'Sent for review: PU-cmw2gwiom009te9wopvdyyjhz', 'Your ENERGY data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2gwiom009te9wopvdyyjhz', NULL, '2026-11-04T13:16:22.527Z'),
  ('cmw2gxyzi00aae9wor9jz00jq', 'SUBMISSION', 'Project site data received: PU-cmw2gxpd000a3e9wosu5x16x5', 'HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line.', 'INFO', FALSE, 'submissions', 'cmw2gxpd000a3e9wosu5x16x5', 'cmvt5801900027kssuly4mmhh', '2026-11-04T13:17:16.063Z'),
  ('cmw2gxzum00abe9wo4efj22ry', 'SUBMISSION', 'Sent for review: PU-cmw2gxpd000a3e9wosu5x16x5', 'Your WATER data for HH-300 Automated Hydraulic Rigs Line has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2gxpd000a3e9wosu5x16x5', NULL, '2026-11-04T13:17:17.183Z'),
  ('cmw2gziuk00ave9wo3nnmjc76', 'SUBMISSION', 'Full Site ESG Package Submitted: HH-300 Automated Hydraulic Rigs Line', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for HH-300 Automated Hydraulic Rigs Line (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2gzhom00are9wofih3t440', 'cmvt5801900027kssuly4mmhh', '2026-11-04T13:18:28.461Z'),
  ('cmw2gzy3p00aze9wob831pxpi', 'SUBMISSION', 'Full Site ESG Package Submitted: HH-300 Automated Hydraulic Rigs Line', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for HH-300 Automated Hydraulic Rigs Line (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2gzhom00are9wofih3t440', 'cmvt5801900027kssuly4mmhh', '2026-11-04T13:18:48.229Z'),
  ('cmw2h2aws00b5e9wodwpcnuya', 'DEADLINE', 'Correction Requested by Project Admin', 'Notes: "gogo"', 'WARNING', FALSE, 'corrections', 'cmw2gwiom009te9wopvdyyjhz', 'cmvt5801900027kssuly4mmhh', '2026-11-04T13:20:38.141Z'),
  ('cmw2hw2x100bxe9wos1lawi8c', 'DEADLINE', 'Correction Requested: HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Project Admin Er. K. Venkataramana requested revisions: "Project Admin audit: Meter delta discrepancies detected on Diesel DG set logs. Please attach audited meter calibration report."', 'WARNING', FALSE, 'corrections', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900027kssuly4mmhh', '2026-11-04T13:43:47.461Z'),
  ('cmw2hwnw600c0e9wo23of8gsx', 'APPROVAL', 'Submission Approved: HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Project Admin Er. K. Venkataramana approved your submission for HH-300 Automated Hydraulic Rigs Line. Note: "All calibration certificates and meter logs verified. Fully approved by Project Admin."', 'SUCCESS', FALSE, 'submissions', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900027kssuly4mmhh', '2026-11-04T13:44:14.647Z'),
  ('cmw2tkri800187kgg4xm71m0w', 'SUBMISSION', 'Project site data received: PU-cmw2tkfqc00117kggxawfmxi8', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Er. K. Venkataramana (PROJECT_ADMIN) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2tkfqc00117kggxawfmxi8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:10:54.848Z'),
  ('cmw2tksov00197kgg2ijf3dk0', 'SUBMISSION', 'Sent for review: PU-cmw2tkfqc00117kggxawfmxi8', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2tkfqc00117kggxawfmxi8', NULL, '2026-11-04T19:10:56.383Z'),
  ('cmw2tsdua001k7kgg2mtujwnh', 'SUBMISSION', 'Project site data received: PU-cmw2ts2dq001d7kgg8z5g9fdp', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2ts2dq001d7kgg8z5g9fdp', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:16:50.386Z'),
  ('cmw2tsexw001l7kggb9krnptn', 'SUBMISSION', 'Sent for review: PU-cmw2ts2dq001d7kgg8z5g9fdp', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2ts2dq001d7kgg8z5g9fdp', NULL, '2026-11-04T19:16:51.812Z'),
  ('cmw2ttruv001u7kggm976tbds', 'SUBMISSION', 'Project site data received: PU-cmw2tti6u001n7kggeb1mo6nv', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2tti6u001n7kggeb1mo6nv', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:17:55.207Z'),
  ('cmw2ttsyf001v7kgghef40n5n', 'SUBMISSION', 'Sent for review: PU-cmw2tti6u001n7kggeb1mo6nv', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2tti6u001n7kggeb1mo6nv', NULL, '2026-11-04T19:17:56.632Z'),
  ('cmw2tu5ju00267kggzvoeccp8', 'SUBMISSION', 'Project site data received: PU-cmw2ttto6001x7kgg7n8rbgh2', 'Pavagada Mega Solar Complex Expansion — Level 2 — Water Management (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2ttto6001x7kgg7n8rbgh2', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:18:12.954Z'),
  ('cmw2tu6td002b7kggvliv66qj', 'SUBMISSION', 'Sent for review: PU-cmw2ttto6001x7kgg7n8rbgh2', 'Your WATER data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2ttto6001x7kgg7n8rbgh2', NULL, '2026-11-04T19:18:14.594Z'),
  ('cmw2tufsk002e7kggv2ire3la', 'SUBMISSION', 'Project site data received: PU-cmw2tu32n00247kggx7xvcsjh', 'Pavagada Mega Solar Complex Expansion — Level 3 — GHG Emissions & Air Quality (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2tu32n00247kggx7xvcsjh', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:18:26.228Z'),
  ('cmw2tugyw002f7kggdyvypcxw', 'SUBMISSION', 'Sent for review: PU-cmw2tu32n00247kggx7xvcsjh', 'Your EMISSIONS data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2tu32n00247kggx7xvcsjh', NULL, '2026-11-04T19:18:27.752Z'),
  ('cmw2tuvll002o7kgg4u58dgna', 'SUBMISSION', 'Project site data received: PU-cmw2tukdm002h7kggohh1c9vj', 'Pavagada Mega Solar Complex Expansion — Level 4 — Waste Management (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2tukdm002h7kggohh1c9vj', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:18:46.713Z'),
  ('cmw2tuwrp002p7kggtmoxltzy', 'SUBMISSION', 'Sent for review: PU-cmw2tukdm002h7kggohh1c9vj', 'Your WASTE data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2tukdm002h7kggohh1c9vj', NULL, '2026-11-04T19:18:48.230Z'),
  ('cmw2tvddr00307kggkbt129gm', 'SUBMISSION', 'Project site data received: PU-cmw2tv14p002r7kggeesb24as', 'Pavagada Mega Solar Complex Expansion — Level 5 — Environmental Permits & Compliance (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2tv14p002r7kggeesb24as', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:19:09.760Z'),
  ('cmw2tvepv00317kgg8uapsyvt', 'SUBMISSION', 'Sent for review: PU-cmw2tv14p002r7kggeesb24as', 'Your COMPLIANCE data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2tv14p002r7kggeesb24as', NULL, '2026-11-04T19:19:11.491Z');
INSERT INTO "public"."Notification" ("id", "ntype", "title", "body", "severity", "read", "linkView", "refId", "subsidiaryId", "createdAt") VALUES
  ('cmw2tvp8400387kgg9lw080wj', 'SUBMISSION', 'Project site data received: PU-cmw2tvclo002z7kggl6jvrph1', 'Pavagada Mega Solar Complex Expansion — Level 6 — Environmental Initiatives (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2tvclo002z7kggl6jvrph1', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:19:25.108Z'),
  ('cmw2tvqxv00397kggrnifn8ml', 'SUBMISSION', 'Sent for review: PU-cmw2tvclo002z7kggl6jvrph1', 'Your INITIATIVES data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2tvclo002z7kggl6jvrph1', NULL, '2026-11-04T19:19:27.331Z'),
  ('cmw2tvww4003b7kggw73zajdh', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:19:35.044Z'),
  ('cmw2u42tg003t7kggof6abgev', 'SUBMISSION', 'Project site data received: PU-cmw2u3t0u003m7kggr41hvt48', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026) — submitted from the Project User Portal by Rohit Kumar (PROJECT_USER) for MEIL Solar Energy Limited · Charanka & Utility-Scale Solar Parks · Pavagada Mega Solar Complex Expansion.', 'INFO', FALSE, 'submissions', 'cmw2u3t0u003m7kggr41hvt48', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:25:55.972Z'),
  ('cmw2u43m5003u7kggg0yczd5b', 'SUBMISSION', 'Sent for review: PU-cmw2u3t0u003m7kggr41hvt48', 'Your ENERGY data for Pavagada Mega Solar Complex Expansion has entered the Project Admin review queue. You will be notified when a reviewer decides.', 'INFO', FALSE, 'submissions', 'cmw2u3t0u003m7kggr41hvt48', NULL, '2026-11-04T19:25:57.005Z'),
  ('cmw2u4e1k003x7kggcn8k37ol', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:26:10.521Z'),
  ('cmw2u5b8200427kggveghgemm', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:26:53.522Z'),
  ('cmw2u7x9a004d7kggbh3gh80n', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:28:55.390Z'),
  ('cmw2ukbmf004m7kggmva86muz', 'SUBMISSION', 'Full Site ESG Package Submitted: Pavagada Mega Solar Complex Expansion', 'Rohit Kumar (PROJECT_USER) submitted all 9 BRSR Environmental disclosure levels for Pavagada Mega Solar Complex Expansion (June 2026). Ready for Project Admin review & approval.', 'INFO', FALSE, 'submissions', 'cmw2fs7qi007ye9won2f1ivy8', 'cmvt5801900017kssdbm9g6sp', '2026-11-04T19:38:33.880Z'),
  ('cmw2ul1b1004p7kggwmksv444', 'APPROVAL', 'Submission Approved: Pavagada Mega Solar Complex Expansion — Level 6 — Training & Workforce Well-being (June 2026)', 'Project Admin Er. K. Venkataramana approved your data submission for HH-300 Automated Hydraulic Rigs Line.', 'SUCCESS', FALSE, 'submissions', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900027kssuly4mmhh', '2026-11-04T19:39:07.166Z'),
  ('cmw2ul2dt004q7kggqxapckry', 'APPROVAL', 'Submission Approved: Pavagada Mega Solar Complex Expansion — Level 6 — Training & Workforce Well-being (June 2026)', 'Project Admin Er. K. Venkataramana approved your data submission for HH-300 Automated Hydraulic Rigs Line.', 'SUCCESS', FALSE, 'submissions', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900027kssuly4mmhh', '2026-11-04T19:39:08.562Z');

-- Table "public"."Project" (32 rows)
INSERT INTO "public"."Project" ("id", "code", "name", "businessUnitId", "location", "ptype", "capacityMw", "status", "frequency", "createdAt", "updatedAt") VALUES
  ('cmvt5836p001t7kssxjh733ng', 'PRJ-RIG-HH300', 'HH-300 Automated Hydraulic Rigs Line', 'cmvt5828s000s7kss8j43ho6y', 'Piacenza, Italy', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5836o001g7kssiazgj9nf', 'PRJ-EITC', 'Eastern Interstate Transmission Corridor', 'cmvt58103000e7kssn69xfr3j', 'Odisha', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.088Z', '2026-10-29T00:39:17.088Z'),
  ('cmvt5836o001d7kssswxq54mz', 'PRJ-BARM', 'Barmer Crude Oil Pipeline Package', 'cmvt58101000a7kss1u47hng4', 'Rajasthan', 'PIPELINE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.088Z', '2026-10-29T00:39:17.088Z'),
  ('cmvt5836o001i7kss5aiva020', 'PRJ-HYD-BUS', 'Hyderabad E-Bus Integration Facility', 'cmvt58103000g7ksso98pnla7', 'Telangana', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.089Z', '2026-10-29T00:39:17.089Z'),
  ('cmvt5836o001f7ksssq1ngm1s', 'PRJ-MONG', 'Mongol Refinery EPC Project (Packages 2 & 3)', 'cmvt58101000a7kss1u47hng4', 'Mongolia', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.088Z', '2026-10-29T00:39:17.088Z'),
  ('cmvt5836n001a7ksspy772hsr', 'PRJ-TBTT', 'Thane-Borivali Twin Tunnel Project', 'cmvt58102000c7kssg4jtvr2x', 'Maharashtra', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.088Z', '2026-10-29T00:39:17.088Z'),
  ('cmvt5836p001l7ksscmzyzwzc', 'PRJ-EV-MOTR', 'NextGen Heavy EV Traction Motor Testing Center', 'cmvt582ba00107ksstpd3cm6s', 'Telangana', 'OFFICE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.089Z', '2026-10-29T00:39:17.089Z'),
  ('cmvt5836q001w7kssm1wxdsd9', 'PRJ-KKD-RIG', 'Kakinada Rig Assembly & Testing Yard', 'cmvt5828s000s7kss8j43ho6y', 'Andhra Pradesh', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5836p001q7ksspme090vs', 'PRJ-PNG-DOM', 'Smart Metered Domestic PNG Infrastructure', 'cmvt582a8000y7kssxl4cy4cw', 'Telangana', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.089Z', '2026-10-29T00:39:17.089Z'),
  ('cmvt5836p001m7kss1sg81ijq', 'PRJ-PMPML-DEP', 'Pune Mahanagar Parivahan E-Fleet Depots', 'cmvt58104000k7ksspd0mp75f', 'Maharashtra', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.089Z', '2026-10-29T00:39:17.089Z'),
  ('cmvt5836p001u7kss3liung3z', 'PRJ-PNG-IND', 'Industrial Cluster High-Pressure PNG Network', 'cmvt582a8000y7kssxl4cy4cw', 'Rajasthan', 'PIPELINE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.089Z', '2026-10-29T00:39:17.089Z'),
  ('cmvt5836n00187kssqlx68664', 'PRJ-POLA', 'Polavaram Irrigation Project Canals & Headworks', 'cmvt5810000087kssr4oure2y', 'Andhra Pradesh', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.087Z', '2026-10-29T00:39:17.087Z'),
  ('cmvt5836n00157kssab54g3lw', 'PRJ-KLIP', 'Kaleshwaram Lift Irrigation Package-06 & 08', 'cmvt5810000087kssr4oure2y', 'Telangana', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.087Z', '2026-10-29T00:39:17.087Z'),
  ('cmvt5836n00167kss0csnb7il', 'PRJ-ZOJ', 'Zojila Strategic Bi-Directional Tunnel', 'cmvt58102000c7kssg4jtvr2x', 'Jammu & Kashmir', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.087Z', '2026-10-29T00:39:17.087Z'),
  ('cmvt5836p001o7kss0tc3098s', 'PRJ-TEL-GAS', 'Telangana & AP Intercity Gas Distribution Grid', 'cmvt58104000j7kssbn61rt7t', 'Telangana', 'PIPELINE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.089Z', '2026-10-29T00:39:17.089Z'),
  ('cmvt583co001y7kssv4sfemdb', 'PRJ-DND-EVI', 'Dindi Electric Bus Green Manufacturing Gigafactory', 'cmvt58103000g7ksso98pnla7', 'Telangana', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.089Z', '2026-10-29T00:39:17.089Z'),
  ('cmvt5842t00267kss1hu41axe', 'PRJ-LATAM-OPS', 'Latin America Deep Drilling Fleet Operations', 'cmvt5828r000q7kss9l8kynqq', 'International', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842s00227kssdkxf07uj', 'PRJ-CNG-MDN', 'Highway Mother Daughter CNG Dispensing Network', 'cmvt582bd00127kssruy3ckw5', 'Andhra Pradesh', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842u00287kssfj1xhipu', 'PRJ-ECO-RIG4', 'Eco-Friendly Workover Rigs Fleet-04', 'cmvt5828r000q7kss9l8kynqq', 'International', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842s00207ksspvdt09eh', 'PRJ-PUGA-GEO', 'Puga Geothermal Deep Exploration Well Project', 'cmvt5827d000m7ksso2iggunp', 'Ladakh', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842u002c7kssl8jciq2c', 'PRJ-PVG-SOL', 'Pavagada Mega Solar Complex Expansion', 'cmvt5829f000w7kss4s9oe6uq', 'Karnataka', 'SOLAR_PARK', 200, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842t00257kss0x11vlwc', 'PRJ-CNG-URB', 'Urban Smart CNG Fast-Refueling Hubs', 'cmvt582bd00127kssruy3ckw5', 'Karnataka', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842v002g7kssxegokowy', 'PRJ-SUB765', '765 kV / 400 kV GIS Substation Grid Package', 'cmvt58103000e7kssn69xfr3j', 'Uttar Pradesh', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842u002b7kssxf18hcgj', 'PRJ-CHR-SOL', 'Charanka 150 MW Solar PV Park', 'cmvt5829f000w7kss4s9oe6uq', 'Gujarat', 'SOLAR_PARK', 150, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5842v002i7kssnqny18q2', 'PRJ-NAR-CANAL', 'Narmada Branch Canal-Top 50 MW Solar Installation', 'cmvt5828z000u7kssqlf7nnl2', 'Gujarat', 'SOLAR_PARK', 50, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.091Z', '2026-10-29T00:39:17.091Z'),
  ('cmvt5842y002k7kssuwfpe73x', 'PRJ-LFP-BATT', 'Advanced LFP Battery Pack Assembly Line', 'cmvt582ba00107ksstpd3cm6s', 'Telangana', 'PLANT', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.091Z', '2026-10-29T00:39:17.091Z'),
  ('cmvt5842u002e7ksst5ue6prl', 'PRJ-GA45-GRID', 'Geographical Area GA-45 Steel Pipeline Grid', 'cmvt58104000j7kssbn61rt7t', 'Karnataka', 'PIPELINE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z'),
  ('cmvt5843w002s7kssp6sats29', 'PRJ-ZE-DRILL', 'Zero-Emission Electric Drilling System Unit 1', 'cmvt5827d000m7ksso2iggunp', 'Europe / Global', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.091Z', '2026-10-29T00:39:17.091Z'),
  ('cmvt5843v002p7kssdoqjzyku', 'PRJ-FLT-SOL', 'Reservoir Floating Solar Power Platform', 'cmvt5828z000u7kssqlf7nnl2', 'Andhra Pradesh', 'SOLAR_PARK', 60, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.091Z', '2026-10-29T00:39:17.091Z'),
  ('cmvt5843v002o7kssqjomr1hq', 'PRJ-KUN-PSH', 'Kundah 500 MW Pumped Storage Hydro Project', 'cmvt5827v000o7kssiez5a1cg', 'Tamil Nadu', 'HYDRO', 500, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.091Z', '2026-10-29T00:39:17.091Z'),
  ('cmvt5843v002q7kss3etabcc9', 'PRJ-PIN-PSH', 'Pinnapuram 1200 MW Integrated Renewable Energy Storage Hydro', 'cmvt5827v000o7kssiez5a1cg', 'Andhra Pradesh', 'HYDRO', 1200, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.091Z', '2026-10-29T00:39:17.091Z'),
  ('cmvt584g8002u7kssqq12r756', 'PRJ-BEST-OPS', 'BEST Mumbai 2,100 E-Bus Fleet Operations', 'cmvt58104000k7ksspd0mp75f', 'Maharashtra', 'SITE', 0, 'ACTIVE', 'MONTHLY', '2026-10-29T00:39:17.090Z', '2026-10-29T00:39:17.090Z');

-- Table "public"."Report" (4 rows)
INSERT INTO "public"."Report" ("id", "reportType", "frameworkId", "reportingYear", "periodLabel", "scopeType", "scopeId", "scopeName", "generatedBy", "generatedByName", "status", "fileName", "fileType", "content", "checksum", "version", "createdAt") VALUES
  ('cmvt6dndv005k7kxwjxpos6yx', 'BRSR', 'cmvt6bfxr000y7kxwu8g3r0oa', 2026, 'April 2026', 'PROJECT', 'cmvt5842u002c7kssl8jciq2c', 'Pavagada Solar Park', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'COMPLETED', 'BRSR-Pavagada-Apr2026-preview.pdf', 'PDF', 'BRSR report content (illustrative)', NULL, 1, '2026-10-29T01:11:36.163Z'),
  ('cmvzflrsn0011e9jwf5v5ans6', 'ESG_SUMMARY', NULL, NULL, NULL, 'PROJECT', 'cmvt5836n00167kss0csnb7il', 'Zojila Strategic Bi-Directional Tunnel', 'cmvt5869900467ksshlt6lz2z', 'Project Site Admin', 'COMPLETED', 'PRJ-ZOJ_Consolidated_Report_FY24-25.pdf', 'PDF', '{"notes":"Annualized consolidated BRSR & ESG report approved by Project Site Administrator.","submittedAt":"2026-11-02T15:46:28.722Z"}', NULL, 1, '2026-11-02T10:16:28.723Z'),
  ('cmvzh9es3001me9jwnu1bqoa1', 'ESG_SUMMARY', NULL, NULL, NULL, 'PROJECT', 'cmvt5836n00167kss0csnb7il', 'Zojila Strategic Bi-Directional Tunnel', 'cmvt5869900467ksshlt6lz2z', 'Project Site Admin', 'COMPLETED', 'PRJ-ZOJ_Consolidated_Report_FY24-25.pdf', 'PDF', '{"notes":"Final consolidated report submitted after all contributor verification.","submittedAt":"2026-11-02T16:32:51.217Z"}', NULL, 1, '2026-11-02T11:02:51.219Z'),
  ('cmvziiegj001xe9jwz36t6qt8', 'ESG_SUMMARY', NULL, NULL, NULL, 'PROJECT', 'cmvt5836n00167kss0csnb7il', 'Zojila Strategic Bi-Directional Tunnel', 'cmvt5869900467ksshlt6lz2z', 'Project Site Admin', 'COMPLETED', 'PRJ-ZOJ_Consolidated_Report_FY24-25.pdf', 'PDF', '{"notes":"","submittedAt":"2026-11-02T17:07:50.320Z"}', NULL, 1, '2026-11-02T11:37:50.323Z');

-- Table "public"."ReportingPackage" (14 rows)
INSERT INTO "public"."ReportingPackage" ("id", "ref", "title", "subsidiaryId", "subsidiaryName", "period", "status", "readinessPct", "summary", "sourceRefs", "submittedAt", "submittedBy", "groupFeedback", "createdAt", "updatedAt") VALUES
  ('cmvt5ewlh000o7kvo0h63pk12', 'RPT-PKG-0001', 'Drillmec S.p.A. — FY 2024-25 ESG Reporting Package', 'cmvt5801900027kssuly4mmhh', 'Drillmec S.p.A.', 'FY 2024-25', 'APPROVED', 100, '{"approved":18,"pending":0,"missing":0,"metrics":[]}', '[]', '2026-06-30T23:00:00.000Z', 'Mei Ling Tan', 'Accepted and consolidated into the FY 2024-25 Group BRSR report.', '2026-10-29T00:44:35.141Z', '2026-10-29T00:44:35.141Z'),
  ('cmvt5exju000p7kvomkrfnig8', 'RPT-PKG-0002', 'Drillmec S.p.A. — FY 2025-26 ESG Reporting Package', 'cmvt5801900027kssuly4mmhh', 'Drillmec S.p.A.', 'FY 2025-26', 'CHANGES_REQUESTED', 72, '{"approved":0,"pending":1,"missing":4,"metrics":[]}', '[]', '2026-10-19T22:27:00.000Z', 'Mei Ling Tan', 'Scope 3 travel figures need the FY25-26 travel register reconciliation before Group consolidation. Re-attach the updated register.', '2026-10-29T00:44:36.378Z', '2026-10-29T00:44:36.378Z'),
  ('cmvt5eyiw000q7kvovj2asm18', 'RPT-PKG-0003', 'Megha City Gas Distribution Holding — FY 2024-25 ESG Reporting Package', 'cmvt5802b00047kssx9rm5o3a', 'Megha City Gas Distribution Holding', 'FY 2024-25', 'APPROVED', 100, '{"approved":18,"pending":0,"missing":0,"metrics":[{"name":"Beneficiaries","value":18400,"unit":"persons"},{"name":"Non-compliance","value":0,"unit":"events"}]}', '["SUB-2526-010","SUB-2526-011"]', '2026-06-30T23:00:00.000Z', 'Kavita Nair', 'Accepted and consolidated into the FY 2024-25 Group BRSR report.', '2026-10-29T00:44:37.641Z', '2026-10-29T00:44:37.641Z'),
  ('cmvt5ezmy000r7kvojtqa6au2', 'RPT-PKG-0004', 'Megha City Gas Distribution Holding — FY 2025-26 ESG Reporting Package', 'cmvt5802b00047kssx9rm5o3a', 'Megha City Gas Distribution Holding', 'FY 2025-26', 'DRAFT', 0, '{"approved":2,"pending":0,"missing":4,"metrics":[{"name":"Beneficiaries","value":18400,"unit":"persons"},{"name":"Non-compliance","value":0,"unit":"events"}]}', '["SUB-2526-010","SUB-2526-011"]', NULL, '', '', '2026-10-29T00:44:38.858Z', '2026-10-29T00:44:38.858Z'),
  ('cmvt5f0kh000s7kvo4p9rrcxf', 'RPT-PKG-0005', 'Megha Engineering & Infrastructures Ltd (MEIL Core) — FY 2024-25 ESG Reporting Package', 'cmvt57yuo00007kss94thg3ht', 'Megha Engineering & Infrastructures Ltd (MEIL Core)', 'FY 2024-25', 'APPROVED', 100, '{"approved":18,"pending":0,"missing":0,"metrics":[{"name":"Scope 2 GHG","value":31540,"unit":"tCO2e"},{"name":"Diesel","value":1284,"unit":"kL"},{"name":"Water withdrawal","value":64200,"unit":"m³"}]}', '["SUB-2526-002","SUB-2526-003","SUB-2526-005"]', '2026-06-30T23:00:00.000Z', 'Priya Deshmukh', 'Accepted and consolidated into the FY 2024-25 Group BRSR report.', '2026-10-29T00:44:40.289Z', '2026-10-29T00:44:40.289Z'),
  ('cmvt5f1ix000t7kvo172rqn4a', 'RPT-PKG-0006', 'Megha Engineering & Infrastructures Ltd (MEIL Core) — FY 2025-26 ESG Reporting Package', 'cmvt57yuo00007kss94thg3ht', 'Megha Engineering & Infrastructures Ltd (MEIL Core)', 'FY 2025-26', 'DRAFT', 0, '{"approved":3,"pending":3,"missing":4,"metrics":[{"name":"Scope 2 GHG","value":31540,"unit":"tCO2e"},{"name":"Diesel","value":1284,"unit":"kL"},{"name":"Water withdrawal","value":64200,"unit":"m³"}]}', '["SUB-2526-002","SUB-2526-003","SUB-2526-005"]', NULL, '', '', '2026-10-29T00:44:41.529Z', '2026-10-29T00:44:41.529Z'),
  ('cmvt5f2ga000u7kvo0fy3tq22', 'RPT-PKG-0007', 'MEIL Hydro Power Limited — FY 2024-25 ESG Reporting Package', 'cmvt5801g00037kssudyfd24t', 'MEIL Hydro Power Limited', 'FY 2024-25', 'APPROVED', 100, '{"approved":18,"pending":0,"missing":0,"metrics":[{"name":"Peak dispatch","value":480,"unit":"MWh"}]}', '["SUB-2526-015"]', '2026-06-30T23:00:00.000Z', 'Shalini Verma', 'Accepted and consolidated into the FY 2024-25 Group BRSR report.', '2026-10-29T00:44:42.730Z', '2026-10-29T00:44:42.730Z'),
  ('cmvt5f3em000v7kvorr1ymv6q', 'RPT-PKG-0008', 'MEIL Hydro Power Limited — FY 2025-26 ESG Reporting Package', 'cmvt5801g00037kssudyfd24t', 'MEIL Hydro Power Limited', 'FY 2025-26', 'DRAFT', 0, '{"approved":1,"pending":0,"missing":4,"metrics":[{"name":"Peak dispatch","value":480,"unit":"MWh"}]}', '["SUB-2526-015"]', NULL, '', '', '2026-10-29T00:44:43.967Z', '2026-10-29T00:44:43.967Z'),
  ('cmvt5f4do000w7kvor92e89fe', 'RPT-PKG-0009', 'MEIL Solar Energy Limited — FY 2024-25 ESG Reporting Package', 'cmvt5801900017kssdbm9g6sp', 'MEIL Solar Energy Limited', 'FY 2024-25', 'APPROVED', 100, '{"approved":18,"pending":0,"missing":0,"metrics":[{"name":"Evaporation saved","value":34500,"unit":"m³"}]}', '["SUB-2526-014"]', '2026-06-30T23:00:00.000Z', 'Divya Iyer', 'Accepted and consolidated into the FY 2024-25 Group BRSR report.', '2026-10-29T00:44:45.228Z', '2026-10-29T00:44:45.228Z'),
  ('cmvt5f59q000x7kvorwfk836m', 'RPT-PKG-0010', 'MEIL Solar Energy Limited — FY 2025-26 ESG Reporting Package', 'cmvt5801900017kssdbm9g6sp', 'MEIL Solar Energy Limited', 'FY 2025-26', 'DRAFT', 0, '{"approved":1,"pending":1,"missing":4,"metrics":[{"name":"Evaporation saved","value":34500,"unit":"m³"}]}', '["SUB-2526-014"]', NULL, '', '', '2026-10-29T00:44:46.383Z', '2026-10-29T00:44:46.383Z'),
  ('cmvt5f66w000y7kvodxsj7vri', 'RPT-PKG-0011', 'Olectra Greentech Limited — FY 2024-25 ESG Reporting Package', 'cmvt5803c00067kss8eawwp01', 'Olectra Greentech Limited', 'FY 2024-25', 'APPROVED', 100, '{"approved":18,"pending":0,"missing":0,"metrics":[{"name":"LTIFR","value":0.28,"unit":"per mn hrs"}]}', '["SUB-2526-007"]', '2026-06-30T23:00:00.000Z', 'Sunita Rao', 'Accepted and consolidated into the FY 2024-25 Group BRSR report.', '2026-10-29T00:44:47.576Z', '2026-10-29T00:44:47.576Z'),
  ('cmvt5f76g000z7kvos4gzgx0h', 'RPT-PKG-0012', 'Olectra Greentech Limited — FY 2025-26 ESG Reporting Package', 'cmvt5803c00067kss8eawwp01', 'Olectra Greentech Limited', 'FY 2025-26', 'DRAFT', 0, '{"approved":1,"pending":0,"missing":4,"metrics":[{"name":"LTIFR","value":0.28,"unit":"per mn hrs"}]}', '["SUB-2526-007"]', NULL, '', '', '2026-10-29T00:44:48.857Z', '2026-10-29T00:44:48.857Z'),
  ('cmvt5f83k00107kvo99lz84yn', 'RPT-PKG-0013', 'Petreven S.p.A. — FY 2024-25 ESG Reporting Package', 'cmvt5802h00057kss5vcrhfln', 'Petreven S.p.A.', 'FY 2024-25', 'APPROVED', 100, '{"approved":18,"pending":0,"missing":0,"metrics":[]}', '[]', '2026-06-30T23:00:00.000Z', 'Elena Rossi', 'Accepted and consolidated into the FY 2024-25 Group BRSR report.', '2026-10-29T00:44:50.048Z', '2026-10-29T00:44:50.048Z'),
  ('cmvt5f91400117kvoz1jak0a1', 'RPT-PKG-0014', 'Petreven S.p.A. — FY 2025-26 ESG Reporting Package', 'cmvt5802h00057kss5vcrhfln', 'Petreven S.p.A.', 'FY 2025-26', 'DRAFT', 0, '{"approved":0,"pending":0,"missing":4,"metrics":[]}', '[]', NULL, '', '', '2026-10-29T00:44:51.256Z', '2026-10-29T00:44:51.256Z');

-- Table "public"."ReportingPeriod" (3 rows)
INSERT INTO "public"."ReportingPeriod" ("id", "reportingYearId", "periodType", "periodLabel", "year", "month", "quarter", "startDate", "endDate", "submissionDeadline", "reviewDeadline", "approvalDeadline", "status", "createdAt") VALUES
  ('cmvt6acpg00047kxwgjmt06r8', 'cmvt6ab0k00027kxwpobqx3ms', 'MONTHLY', 'April 2026', 2026, 3, NULL, '2026-03-31T18:30:00.000Z', '2026-04-29T18:30:00.000Z', '2026-04-30T18:29:59.000Z', '2026-05-10T18:29:59.000Z', '2026-05-20T18:29:59.000Z', 'OPEN', '2026-10-29T01:09:02.356Z'),
  ('cmvt6aee700067kxwsqtxlpql', 'cmvt6ab0k00027kxwpobqx3ms', 'MONTHLY', 'May 2026', 2026, 4, NULL, '2026-04-30T18:30:00.000Z', '2026-05-30T18:30:00.000Z', '2026-05-31T18:29:59.000Z', '2026-06-10T18:29:59.000Z', '2026-06-20T18:29:59.000Z', 'OPEN', '2026-10-29T01:09:04.543Z'),
  ('cmvt6ag9q00087kxwvb2pkxhx', 'cmvt6ab0k00027kxwpobqx3ms', 'MONTHLY', 'June 2026', 2026, 5, NULL, '2026-05-31T18:30:00.000Z', '2026-06-29T18:30:00.000Z', '2026-06-30T18:29:59.000Z', '2026-07-10T18:29:59.000Z', '2026-07-20T18:29:59.000Z', 'OPEN', '2026-10-29T01:09:06.777Z');

-- Table "public"."ReportingTimeline" (24 rows)
INSERT INTO "public"."ReportingTimeline" ("id", "ref", "name", "period", "level", "subsidiaryId", "businessUnitId", "projectId", "startDate", "dueDate", "reviewDeadline", "categories", "inheritanceMode", "overrideReason", "notify", "status", "createdByName", "createdAt", "updatedAt") VALUES
  ('cmvt5e95d00007kvoze6cdo8g', 'RTL-0001', 'DRILLMEC — Annual ESG reporting window', 'FY 2025-26', 'SUBSIDIARY', 'cmvt5801900027kssuly4mmhh', NULL, NULL, '2026-09-13T22:15:00.000Z', '2026-11-21T23:48:00.000Z', '2026-11-28T23:47:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Group-mandated reporting window for all subsidiaries.', TRUE, 'ACTIVE', 'Arun Bhaskar', '2026-10-29T00:44:04.753Z', '2026-10-29T00:44:04.753Z'),
  ('cmvt5ecdg00037kvoput1db5c', 'RTL-0004', 'PRJ-PUGA-GEO — site data cut-off', 'FY 2025-26', 'PROJECT', 'cmvt5801900027kssuly4mmhh', NULL, 'cmvt5842s00207ksspvdt09eh', '2026-09-18T22:40:00.000Z', '2026-11-09T23:24:00.000Z', '2026-11-12T23:15:00.000Z', '["ENVIRONMENT","SAFETY"]', 'OVERRIDE', 'Site closes for monsoon; data frozen early.', TRUE, 'ACTIVE', 'Mei Ling Tan', '2026-10-29T00:44:08.932Z', '2026-10-29T00:44:08.932Z'),
  ('cmvt5edc800047kvoz0l3sivq', 'RTL-0005', 'MCGDH — Annual ESG reporting window', 'FY 2025-26', 'SUBSIDIARY', 'cmvt5802b00047kssx9rm5o3a', NULL, NULL, '2026-09-13T22:15:00.000Z', '2026-11-21T23:48:00.000Z', '2026-11-28T23:47:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Group-mandated reporting window for all subsidiaries.', TRUE, 'ACTIVE', 'Arun Bhaskar', '2026-10-29T00:44:10.184Z', '2026-10-29T00:44:10.184Z'),
  ('cmvt5ee9c00057kvonqpsrksn', 'RTL-0006', 'CCDS — plant shutdown window extension', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', NULL, '2026-09-20T22:14:00.000Z', '2026-11-14T23:49:00.000Z', '2026-11-19T23:14:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS"]', 'OVERRIDE', 'Annual maintenance shutdown delays meter reading consolidation.', TRUE, 'ACTIVE', 'Kavita Nair', '2026-10-29T00:44:11.376Z', '2026-10-29T00:44:11.376Z'),
  ('cmvt5ef6e00067kvouiq39h9j', 'RTL-0007', 'CGDN — inherited reporting window', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', NULL, '2026-09-13T22:15:00.000Z', NULL, NULL, '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'INHERIT', '', TRUE, 'ACTIVE', 'Kavita Nair', '2026-10-29T00:44:12.566Z', '2026-10-29T00:44:12.566Z'),
  ('cmvt5eg6500077kvo2ck8qpvi', 'RTL-0008', 'PRJ-GA45-GRID — site data cut-off', 'FY 2025-26', 'PROJECT', 'cmvt5802b00047kssx9rm5o3a', NULL, 'cmvt5842u002e7ksst5ue6prl', '2026-09-18T22:40:00.000Z', '2026-11-09T23:24:00.000Z', '2026-11-12T23:15:00.000Z', '["ENVIRONMENT","SAFETY"]', 'OVERRIDE', 'Site closes for monsoon; data frozen early.', TRUE, 'ACTIVE', 'Kavita Nair', '2026-10-29T00:44:13.853Z', '2026-10-29T00:44:13.853Z'),
  ('cmvt5eh3j00087kvo8h5i40an', 'RTL-0009', 'MEIL — Annual ESG reporting window', 'FY 2025-26', 'SUBSIDIARY', 'cmvt57yuo00007kss94thg3ht', NULL, NULL, '2026-09-13T22:15:00.000Z', '2026-11-21T23:48:00.000Z', '2026-11-28T23:47:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Group-mandated reporting window for all subsidiaries.', TRUE, 'ACTIVE', 'Arun Bhaskar', '2026-10-29T00:44:15.055Z', '2026-10-29T00:44:15.055Z'),
  ('cmvt5ei0h00097kvojkie5l9j', 'RTL-0010', 'HCIT — plant shutdown window extension', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', NULL, '2026-09-20T22:14:00.000Z', '2026-11-14T23:49:00.000Z', '2026-11-19T23:14:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS"]', 'OVERRIDE', 'Annual maintenance shutdown delays meter reading consolidation.', TRUE, 'ACTIVE', 'Priya Deshmukh', '2026-10-29T00:44:16.242Z', '2026-10-29T00:44:16.242Z'),
  ('cmvt5ejzf000b7kvorswfru6m', 'RTL-0012', 'PRJ-BARM — site data cut-off', 'FY 2025-26', 'PROJECT', 'cmvt57yuo00007kss94thg3ht', NULL, 'cmvt5836o001d7kssswxq54mz', '2026-09-18T22:40:00.000Z', '2026-11-09T23:24:00.000Z', '2026-11-12T23:15:00.000Z', '["ENVIRONMENT","SAFETY"]', 'OVERRIDE', 'Site closes for monsoon; data frozen early.', TRUE, 'ACTIVE', 'Priya Deshmukh', '2026-10-29T00:44:18.796Z', '2026-10-29T00:44:18.796Z'),
  ('cmvt5el1j000c7kvo7lhe5jdb', 'RTL-0013', 'MHYDRO — Annual ESG reporting window', 'FY 2025-26', 'SUBSIDIARY', 'cmvt5801g00037kssudyfd24t', NULL, NULL, '2026-09-13T22:15:00.000Z', '2026-11-21T23:48:00.000Z', '2026-11-28T23:47:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Group-mandated reporting window for all subsidiaries.', TRUE, 'ACTIVE', 'Arun Bhaskar', '2026-10-29T00:44:20.167Z', '2026-10-29T00:44:20.167Z'),
  ('cmvt5elxe000d7kvoe8g830rn', 'RTL-0014', 'MPSP — plant shutdown window extension', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', NULL, '2026-09-20T22:14:00.000Z', '2026-11-14T23:49:00.000Z', '2026-11-19T23:14:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS"]', 'OVERRIDE', 'Annual maintenance shutdown delays meter reading consolidation.', TRUE, 'ACTIVE', 'Shalini Verma', '2026-10-29T00:44:21.315Z', '2026-10-29T00:44:21.315Z'),
  ('cmvt5en2j000e7kvo8vtaz4oc', 'RTL-0015', 'MSOLAR — Annual ESG reporting window', 'FY 2025-26', 'SUBSIDIARY', 'cmvt5801900017kssdbm9g6sp', NULL, NULL, '2026-09-13T22:15:00.000Z', '2026-11-21T23:48:00.000Z', '2026-11-28T23:47:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Group-mandated reporting window for all subsidiaries.', TRUE, 'ACTIVE', 'Arun Bhaskar', '2026-10-29T00:44:22.565Z', '2026-10-29T00:44:22.565Z'),
  ('cmvt5eo1f000f7kvonffgsl0s', 'RTL-0016', 'CUSP — plant shutdown window extension', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', NULL, '2026-09-20T22:14:00.000Z', '2026-11-14T23:49:00.000Z', '2026-11-19T23:14:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS"]', 'OVERRIDE', 'Annual maintenance shutdown delays meter reading consolidation.', TRUE, 'ACTIVE', 'Divya Iyer', '2026-10-29T00:44:24.050Z', '2026-10-29T00:44:24.050Z'),
  ('cmvt5ep12000g7kvogwjtxwm1', 'RTL-0017', 'ICFS — inherited reporting window', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', NULL, '2026-09-13T22:15:00.000Z', NULL, NULL, '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'INHERIT', '', TRUE, 'ACTIVE', 'Divya Iyer', '2026-10-29T00:44:25.334Z', '2026-10-29T00:44:25.334Z'),
  ('cmvt5eq0j000h7kvojebiii94', 'RTL-0018', 'PRJ-FLT-SOL — site data cut-off', 'FY 2025-26', 'PROJECT', 'cmvt5801900017kssdbm9g6sp', NULL, 'cmvt5843v002p7kssdoqjzyku', '2026-09-18T22:40:00.000Z', '2026-11-09T23:24:00.000Z', '2026-11-12T23:15:00.000Z', '["ENVIRONMENT","SAFETY"]', 'OVERRIDE', 'Site closes for monsoon; data frozen early.', TRUE, 'ACTIVE', 'Divya Iyer', '2026-10-29T00:44:26.611Z', '2026-10-29T00:44:26.611Z'),
  ('cmvt5eqxk000i7kvorwo6uv28', 'RTL-0019', 'OLECTRA — Annual ESG reporting window', 'FY 2025-26', 'SUBSIDIARY', 'cmvt5803c00067kss8eawwp01', NULL, NULL, '2026-09-13T22:15:00.000Z', '2026-11-21T23:48:00.000Z', '2026-11-28T23:47:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Group-mandated reporting window for all subsidiaries.', TRUE, 'ACTIVE', 'Arun Bhaskar', '2026-10-29T00:44:27.800Z', '2026-10-29T00:44:27.800Z'),
  ('cmvt5erv2000j7kvowu7n7xmv', 'RTL-0020', 'EBMP — plant shutdown window extension', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', NULL, '2026-09-20T22:14:00.000Z', '2026-11-14T23:49:00.000Z', '2026-11-19T23:14:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS"]', 'OVERRIDE', 'Annual maintenance shutdown delays meter reading consolidation.', TRUE, 'ACTIVE', 'Sunita Rao', '2026-10-29T00:44:29.006Z', '2026-10-29T00:44:29.006Z'),
  ('cmvt5ets7000l7kvo0m583jbm', 'RTL-0022', 'PRJ-EV-MOTR — site data cut-off', 'FY 2025-26', 'PROJECT', 'cmvt5803c00067kss8eawwp01', NULL, 'cmvt5836p001l7ksscmzyzwzc', '2026-09-18T22:40:00.000Z', '2026-11-09T23:24:00.000Z', '2026-11-12T23:15:00.000Z', '["ENVIRONMENT","SAFETY"]', 'OVERRIDE', 'Site closes for monsoon; data frozen early.', TRUE, 'ACTIVE', 'Sunita Rao', '2026-10-29T00:44:31.495Z', '2026-10-29T00:44:31.495Z'),
  ('cmvt5ebds00027kvobc6l70a0', 'RTL-0003', 'GCDS — inherited reporting window', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', NULL, '2026-09-13T22:15:00.000Z', '2026-10-24T06:35:00.000Z', '2026-10-27T06:26:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Q1 review window lapsed while the reviewer queue was cleared — escalated for priority decision.', TRUE, 'ACTIVE', 'Mei Ling Tan', '2026-10-29T00:44:07.648Z', '2026-10-29T00:47:00.936Z'),
  ('cmvt5euo0000m7kvoxzd5045l', 'RTL-0023', 'PETREVEN — Annual ESG reporting window', 'FY 2025-26', 'SUBSIDIARY', 'cmvt5802h00057kss5vcrhfln', NULL, NULL, '2026-09-13T22:15:00.000Z', '2026-11-21T23:48:00.000Z', '2026-11-28T23:47:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","WATER","WASTE","SAFETY","WORKFORCE","PROCUREMENT","CSR","COMPLIANCE"]', 'OVERRIDE', 'Group-mandated reporting window for all subsidiaries.', TRUE, 'ACTIVE', 'Arun Bhaskar', '2026-10-29T00:44:32.640Z', '2026-10-29T00:44:32.640Z'),
  ('cmvt5evmn000n7kvo8huz90ut', 'RTL-0024', 'GCOS — plant shutdown window extension', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', NULL, '2026-09-20T22:14:00.000Z', '2026-11-14T23:49:00.000Z', '2026-11-19T23:14:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS"]', 'OVERRIDE', 'Annual maintenance shutdown delays meter reading consolidation.', TRUE, 'ACTIVE', 'Elena Rossi', '2026-10-29T00:44:33.888Z', '2026-10-29T00:44:33.888Z'),
  ('cmvt5eaf300017kvo6ngus7u2', 'RTL-0002', 'ARAM — plant shutdown window extension', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, '2026-09-20T22:14:00.000Z', '2026-11-01T07:51:00.000Z', '2026-11-01T07:51:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS"]', 'OVERRIDE', 'Aligned the review window with the quarter-end consolidation cut-off.', TRUE, 'ACTIVE', 'Mei Ling Tan', '2026-10-29T00:44:06.172Z', '2026-10-29T00:46:55.706Z'),
  ('cmvt62zz700007kj49917t0bs', 'TL-BU-HRP', 'Hydrocarbons, Refinery & Pipelines — Reporting Window', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', NULL, '2026-10-08T21:40:00.000Z', '2026-11-05T07:13:00.000Z', '2026-10-31T07:38:00.000Z', '["ENVIRONMENT","ENERGY","EMISSIONS","SAFETY"]', 'OVERRIDE', 'Thermal fleet maintenance window — earlier BU deadline required to align with Q2 closure.', TRUE, 'ACTIVE', 'Suresh Babu', '2026-10-29T01:03:19.267Z', '2026-10-29T01:03:19.267Z'),
  ('cmvt630tq00017kj45dp8a2a2', 'TL-BU-EPBI', 'EV Powertrain & Battery Integration Division — Reporting Window', 'FY 2025-26', 'BUSINESS_UNIT', 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', NULL, '2026-10-03T21:05:00.000Z', '2026-11-12T07:26:00.000Z', '2026-11-07T07:51:00.000Z', '["WATER","ENVIRONMENT","WORKFORCE"]', 'OVERRIDE', 'Water-grid reporting cadence — quarterly closure aligned with state regulator deadline.', TRUE, 'ACTIVE', 'Kiran Reddy', '2026-10-29T01:03:20.366Z', '2026-10-29T01:03:20.366Z');

-- Table "public"."ReportingYear" (1 rows)
INSERT INTO "public"."ReportingYear" ("id", "groupId", "year", "label", "status", "createdAt") VALUES
  ('cmvt6ab0k00027kxwpobqx3ms', 'MEIL-GROUP', 2026, 'FY 2026-27', 'OPEN', '2026-10-29T01:09:00.164Z');

-- Table "public"."SafetyRecord" (1 rows)
INSERT INTO "public"."SafetyRecord" ("id", "projectId", "reportingPeriodId", "module", "recordType", "fatalities", "injuries", "lostTimeIncidents", "recordableInjuries", "highConsequenceIncidents", "trainingHours", "safetyHours", "manHoursWorked", "correctiveActions", "evidenceId", "validationStatus", "status", "revisionNumber", "enteredBy", "enteredAt", "updatedAt") VALUES
  ('cmvt6cnpk003q7kxwo7vdxfq2', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'SAFETY', 'INCIDENT', 0, 1, 0, 1, 0, 96, 28800, 48600, 'Toolbox talk + PPE audit', NULL, 'PASSED', 'APPROVED', 1, 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:49.928Z', '2026-10-29T01:10:49.928Z');

-- Table "public"."Session" (18 rows)
INSERT INTO "public"."Session" ("id", "tokenHash", "userId", "userAgent", "ip", "expiresAt", "revokedAt", "createdAt") VALUES
  ('cmvzb6x5n0001e9jwyqf2x5nm', '128a24c6a648b8caec7ff37f726af15dd4c7e5f36084e1cb72ef6564950882fd', 'cmvt585d1003b7kssa9gqdy4a', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-IN) WindowsPowerShell/5.1.26100.9711', '::1', '2026-11-02T16:12:57.363Z', NULL, '2026-11-02T08:12:57.367Z'),
  ('cmvzdzfk4000he9jwaecbdyhz', '6f7cffcd0bcd07c5be9602b1584ccef8c972be078b3aa884c32b4666b50dd84f', 'cmvt5869900467ksshlt6lz2z', 'node', '::1', '2026-11-02T17:31:06.816Z', NULL, '2026-11-02T09:31:06.819Z'),
  ('cmvze1sr6000le9jweljdovbo', '8e523ad7aaf99804a169e9f91804a0fc9f436d8e45cc71f52290ed016ec5a415', 'cmvt5869900467ksshlt6lz2z', 'node', '::1', '2026-11-02T17:32:55.754Z', NULL, '2026-11-02T09:32:55.756Z'),
  ('cmvzfixx8000re9jwhshyo6f2', '8e26c504c248fad0f7d04cc78e6cf108cc9e39fe3712bdf942e53407ccad6b10', 'cmvt5869900467ksshlt6lz2z', 'node', '::1', '2026-11-02T18:14:16.680Z', NULL, '2026-11-02T10:14:16.698Z'),
  ('cmvzfmf4x0016e9jwp38ngps7', '30a1070336800673d15c207086e0a4c5113291730fecc4ab5a9e700fc048e92a', 'cmvt5869900467ksshlt6lz2z', 'node', '::1', '2026-11-02T18:16:58.972Z', NULL, '2026-11-02T10:16:58.977Z'),
  ('cmvzfuai5001ae9jwhslauu3n', 'dd0c0e00eb3555fcaae722c7a1d5309c7a297e0ddb267ec7f60527280558f4fb', 'cmvt5869900467ksshlt6lz2z', 'node', '::1', '2026-11-02T18:23:06.220Z', NULL, '2026-11-02T10:23:06.221Z'),
  ('cmw2b7oy1003ee9wo24gp5my9', 'adb631bb4abe67741b53c52cb36bec2d60e5a4a8908130f9dc28630fe1c2a72b', 'cmvt59nan000f7k44ov5pssam', 'Python-urllib/3.13', '::1', '2026-11-04T18:36:51.912Z', NULL, '2026-11-04T10:36:51.914Z'),
  ('cmw2df4ns0059e9wo0o8t9e9l', '3aa5f117b003ff153fc77b830ddfb7b433d925462c67b919cf4f5dcf7a4b6556', 'cmvt59nan000f7k44ov5pssam', 'Python-urllib/3.13', '::1', '2026-11-04T19:38:38.103Z', NULL, '2026-11-04T11:38:38.104Z'),
  ('cmw2ftc83008ce9wosu2g3hqr', '0f737f43a4f6c0207d36357bd30ee3e529f0e2126e3a6fd02bc09147027c8d30', 'cmvt59nan000f7k44ov5pssam', 'Python-urllib/3.13', '::1', '2026-11-04T20:45:40.322Z', NULL, '2026-11-04T12:45:40.324Z'),
  ('cmw2fvwf2008ne9wo4zid33h7', '368e84b8a6f86155558d5b5ce319692dc93a46a41bd00423aedd53eb1cf732eb', 'cmvt59nan000f7k44ov5pssam', 'Python-urllib/3.13', '::1', '2026-11-04T20:47:39.805Z', NULL, '2026-11-04T12:47:39.806Z'),
  ('cmw2fwyka008re9worzmd0839', 'e8ccc0e0dacf2c065e59314d75b7a30e2a864efb88fec413456bc539ff17c1c2', 'cmvt59nan000f7k44ov5pssam', 'Python-urllib/3.13', '::1', '2026-11-04T20:48:29.242Z', NULL, '2026-11-04T12:48:29.243Z'),
  ('cmw2fy7m0008ve9wom94o0lgh', '30e2f8fec8d622dbb7c7c2de78be1615f58e3c83ffa25c0fb700630933e6733c', 'cmvt59nan000f7k44ov5pssam', 'Python-urllib/3.13', '::1', '2026-11-04T20:49:27.623Z', NULL, '2026-11-04T12:49:27.624Z'),
  ('cmw2gto4p009pe9woh9rczfhd', '0bb2af4e5827a944b53cc12117e0f52bf163b25a2862768a32ebfb077a13733b', 'cmvt596uj00017k44uqelt2ry', 'Bun/1.4.2', '::1', '2026-11-04T21:13:55.368Z', NULL, '2026-11-04T13:13:55.369Z'),
  ('cmw2heaii00bbe9wolx8syb5f', '24cac5277b97654d9daebe77aefa2eaa9fb8bcc5df94220da9c303c550f7c8c5', 'cmvt596uj00017k44uqelt2ry', 'Python-urllib/3.13', '::1', '2026-11-04T21:29:57.497Z', NULL, '2026-11-04T13:29:57.498Z'),
  ('cmw2hiv5t00bfe9wocygux2qv', '0b8c6d8a4973b1e6b9ea50c6d485732e118cf43eee8b1cc7ece7474416c4888f', 'cmvt596uj00017k44uqelt2ry', 'Python-urllib/3.13', '::1', '2026-11-04T21:33:30.880Z', NULL, '2026-11-04T13:33:30.881Z'),
  ('cmw2huvs000ble9wo6d4aovl0', '2e248d5f1ee62907319bf6564cd23af7eaa50770fd502017952ce6b28b3a58ed', 'cmvt596uj00017k44uqelt2ry', 'Python-urllib/3.13', '::1', '2026-11-04T21:42:51.551Z', NULL, '2026-11-04T13:42:51.552Z'),
  ('cmw2hvb7h00bpe9wop5ywp2ar', '9e71b46e37f3b72e27ddf9d851669cc872187ada5c5945c24ef7e18d9133cc04', 'cmvt596uj00017k44uqelt2ry', 'Python-urllib/3.13', '::1', '2026-11-04T21:43:11.547Z', NULL, '2026-11-04T13:43:11.549Z'),
  ('cmw2hvqd000bte9woml5kto3v', '768f9ab4c74e9061480e4f8d12e9d0433c0526e5baccdb38338a08fa932df25b', 'cmvt59nan000f7k44ov5pssam', 'Python-urllib/3.13', '::1', '2026-11-04T21:43:31.186Z', NULL, '2026-11-04T13:43:31.188Z');

-- Table "public"."SoAuditLog" (56 rows)
INSERT INTO "public"."SoAuditLog" ("id", "actorId", "actorName", "actorRole", "action", "entityType", "entityId", "oldState", "newState", "reason", "metadata", "ipAddress", "createdAt") VALUES
  ('cmvt6cw4q00437kxwo9xkkgy1', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Environment Data User', 'CREATE', 'EnergyRecord', 'cmvt6cbn0002u7kxwnqme7rdj', NULL, '{"quantity":384000,"source":"Grid Electricity","status":"DRAFT"}', 'April grid electricity entry', NULL, NULL, '2026-05-02T02:50:00.000Z'),
  ('cmvt6cw4q00447kxwkkmrw7nj', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Environment Data User', 'EVIDENCE_UPLOAD', 'Evidence', 'cmvt6cols003s7kxwhp79iqgg', NULL, '{"fileName":"PVAN-Grid-Bill-Apr2026.csv"}', 'Evidence attached to grid record', NULL, NULL, '2026-05-02T03:15:00.000Z'),
  ('cmvt6cw4q00457kxw5isu96an', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Environment Data User', 'CALCULATION', 'EnergyRecord', 'cmvt6cbn0002u7kxwnqme7rdj', NULL, '{"calculatedValue":274.94,"scope":"SCOPE_2","factorVersion":1}', 'Emission calculation: 384000 kWh * 0.716', NULL, NULL, '2026-05-02T03:30:00.000Z'),
  ('cmvt6cw4q00467kxwiearg483', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Environment Data User', 'SUBMIT', 'SoSubmission', 'cmvt6ct7b003y7kxwaiyjbsp2', NULL, '{"status":"SUBMITTED"}', 'Energy module submission April 2026', NULL, NULL, '2026-05-03T04:30:00.000Z'),
  ('cmvt6cw4q00477kxw4nfz1p7j', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Environment Data User', 'EVIDENCE_VERIFY', 'Evidence', 'cmvt6cols003s7kxwhp79iqgg', NULL, '{"status":"VERIFIED"}', 'Grid bill verified against meter reading', NULL, NULL, '2026-05-06T05:30:00.000Z'),
  ('cmw29izje000ge9wogh6r88js', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Site Data Entry', 'EVIDENCE_UPLOAD', 'Evidence', 'cmw29ixz1000ee9woshb4lr47', NULL, '{"fileName":"VID 20261026 051852 188.pdf","filePath":"/evidence-uploads/1793805576435-VID_20261026_051852_188.pdf","hash":"sha256:3ee6604acc0f40e369b8b1ec498a332d170f34f2ec419be2df487363e29b47d8"}', 'Evidence uploaded by Rohit Kumar', NULL, NULL, '2026-11-04T09:49:39.626Z'),
  ('cmw29n3it000me9wo8rxbc4yh', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw29mw0u-pjk3', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":18197.038,"resultUnit":"tCO2e","scope":"SCOPE_1_2","factorId":"MULTI-SOURCE-8-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (8 sources: Grid electricity (384000 kWh), Renewable electricity (565656 kWh), Diesel (6766767 litres)...)","normalizedValue":263429.59,"normalizedUnit":"GJ","sourceValue":7744168,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for review', NULL, NULL, '2026-11-04T09:52:51.414Z'),
  ('cmw29nq6u000ue9wovoy2unxd', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'CREATE', 'Submission', 'cmw29no6s000se9woi4mz4ejy', NULL, '{"projectId":"cmvt5836p001t7kssxjh733ng","reportingPeriodId":"cmvt6ag9q00087kxwvb2pkxhx","module":"ENERGY","title":"Project — Level 1 — Energy Consumption (June 2026)","recordIds":["rec-l1-mw29mw0u-pjk3"],"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}}', 'Submission created in DRAFT state', NULL, NULL, '2026-11-04T09:53:20.790Z'),
  ('cmw29nzhb000we9wo8s7fy47z', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submission', 'cmw29no6s000se9woi4mz4ejy', '{"status":"DRAFT","rollup":null}', '{"status":"SUBMITTED","rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}}', 'Submitted via Data Entry Workspace — Level 1 — Energy Consumption', NULL, NULL, '2026-11-04T09:53:32.832Z'),
  ('cmw29qlbn001ae9woxf76zptp', 'cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'PROJECT_ADMIN', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw29qdxl-hb21', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for review', NULL, NULL, '2026-11-04T09:55:34.451Z'),
  ('cmw29rjbb001ie9wohexwjv66', 'cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'PROJECT_ADMIN', 'CREATE', 'Submission', 'cmw29rhe5001ge9wo5yykjkdc', NULL, '{"projectId":"cmvt5836p001t7kssxjh733ng","reportingPeriodId":"cmvt6ag9q00087kxwvb2pkxhx","module":"ENERGY","title":"Project — Level 1 — Energy Consumption (June 2026)","recordIds":["rec-l1-mw29qdxl-hb21"],"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submission created in DRAFT state', NULL, NULL, '2026-11-04T09:56:18.503Z'),
  ('cmw29rrto001ke9won354vej4', 'cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'PROJECT_ADMIN', 'SUBMIT', 'Submission', 'cmw29rhe5001ge9wo5yykjkdc', '{"status":"DRAFT","rollup":null}', '{"status":"SUBMITTED","rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submitted via Data Entry Workspace — Level 1 — Energy Consumption', NULL, NULL, '2026-11-04T09:56:29.532Z'),
  ('cmw2azxes002ae9wo9pop3tgk', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2azp7d-glz0', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"FAILED","calculation":{"calculatedValue":null,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"CEA-V19-SCOPE_2","factorVersion":1,"methodologyNote":"CEA v19 (0.716 kgCO2e/unit) deterministic calculation","normalizedValue":null,"normalizedUnit":"GJ","sourceValue":null,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T10:30:49.064Z'),
  ('cmw2b0o8r002me9wo7mm4izyu', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2b0i0e-43x8', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"FAILED","calculation":{"calculatedValue":null,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"CEA-V19-SCOPE_2","factorVersion":1,"methodologyNote":"CEA v19 (0.716 kgCO2e/unit) deterministic calculation","normalizedValue":null,"normalizedUnit":"GJ","sourceValue":null,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T10:31:24.411Z'),
  ('cmw2b3ts90032e9wor6yijeng', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2b3oby-pcno', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"FAILED","calculation":{"calculatedValue":null,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"CEA-V19-SCOPE_2","factorVersion":1,"methodologyNote":"CEA v19 (0.716 kgCO2e/unit) deterministic calculation","normalizedValue":null,"normalizedUnit":"GJ","sourceValue":null,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T10:33:51.215Z'),
  ('cmw2bzbhw003te9wont5lfuuy', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2bz7fs-4e67', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T10:58:20.540Z'),
  ('cmw2bzlkk0041e9wof4n7jh3h', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'CREATE', 'Submission', 'cmw2bzjcu003ye9wodl8r6lvz', NULL, '{"projectId":"cmvt5836p001t7kssxjh733ng","reportingPeriodId":"cmvt6ag9q00087kxwvb2pkxhx","module":"ENERGY","title":"Project — Level 1 — Energy Consumption (June 2026)","recordIds":["rec-l1-mw2bz7fs-4e67"],"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submission created in DRAFT state', NULL, NULL, '2026-11-04T10:58:33.909Z'),
  ('cmw2bzsp70043e9wo0ykeifcg', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submission', 'cmw2bzjcu003ye9wodl8r6lvz', '{"status":"DRAFT","rollup":null}', '{"status":"SUBMITTED","rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submitted via Data Entry Workspace — Level 1 — Energy Consumption', NULL, NULL, '2026-11-04T10:58:43.148Z'),
  ('cmw2de0eq004ze9wocpgeyjyb', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2ddzhr004ve9womqlso1he', NULL, '{"levelsSubmitted":9,"project":"Kakinada Rig Assembly & Testing Yard","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T11:37:45.754Z'),
  ('cmw2df24s0056e9wogbr7j72k', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2ddzhr004ve9womqlso1he', NULL, '{"levelsSubmitted":9,"project":"Kakinada Rig Assembly & Testing Yard","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T11:38:34.828Z'),
  ('cmw2dngbr005ke9wojtptaghe', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2dncyl-nbzd', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T11:45:06.471Z'),
  ('cmw2dnuql005ue9woepgimzsn', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'CREATE', 'Submission', 'cmw2dns7e005se9wo5c830bwd', NULL, '{"projectId":"cmvt5836p001t7kssxjh733ng","reportingPeriodId":"cmvt6ag9q00087kxwvb2pkxhx","module":"ENERGY","title":"Project — Level 1 — Energy Consumption (June 2026)","recordIds":["rec-l1-mw2dncyl-nbzd"],"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}}', 'Submission created in DRAFT state', NULL, NULL, '2026-11-04T11:45:24.837Z'),
  ('cmw2do2h8005we9wo6n5phnci', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submission', 'cmw2dns7e005se9wo5c830bwd', '{"status":"DRAFT","rollup":null}', '{"status":"SUBMITTED","rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}}', 'Submitted via Data Entry Workspace — Level 1 — Energy Consumption', NULL, NULL, '2026-11-04T11:45:35.181Z'),
  ('cmw2dovmt0066e9wokleo86jn', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'CREATE', 'Submission', 'cmw2dotyg0064e9womt3d1upm', NULL, '{"projectId":"cmvt5836p001t7kssxjh733ng","reportingPeriodId":"cmvt6ag9q00087kxwvb2pkxhx","module":"ENERGY","title":"Project — Level 1 — Energy Consumption (June 2026)","recordIds":["rec-l1-mw2dncyl-nbzd"],"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}}', 'Submission created in DRAFT state', NULL, NULL, '2026-11-04T11:46:12.965Z'),
  ('cmw2dp1gf006ae9wos0eipyhc', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submission', 'cmw2dotyg0064e9womt3d1upm', '{"status":"DRAFT","rollup":null}', '{"status":"SUBMITTED","rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}}', 'Submitted via Data Entry Workspace — Level 1 — Energy Consumption', NULL, NULL, '2026-11-04T11:46:20.511Z'),
  ('cmw2dqzmp006ke9woqw8ql7yy', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l2-mw2dqvql-lrte', NULL, '{"level":2,"levelName":"Level 2 — Water Management","validationStatus":"PASSED","calculation":{"calculatedValue":18300,"resultUnit":"kL Net Withdrawal","scope":"WATER_CIRCULARITY","factorId":"MULTI-WATER-1-SOURCES","methodologyNote":"Multi-source water circularity: 6,200 kL recycled (25.3% circular recovery) across 1 sources (Groundwater (24500 kL)).","sourceValue":24500,"sourceUnit":"kL","normalizedValue":24500,"normalizedUnit":"kL Gross"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T11:47:51.276Z'),
  ('cmw2dr6m5006re9woycd74amx', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'CREATE', 'Submission', 'cmw2dr4n7006ne9woeykdmzzq', NULL, '{"projectId":"cmvt5836p001t7kssxjh733ng","reportingPeriodId":"cmvt6ag9q00087kxwvb2pkxhx","module":"WATER","title":"Project — Level 2 — Water Management (June 2026)","recordIds":["rec-l2-mw2dqvql-lrte"],"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submission created in DRAFT state', NULL, NULL, '2026-11-04T11:48:00.510Z'),
  ('cmw2drdyg006ue9wob1o57pgh', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submission', 'cmw2dr4n7006ne9woeykdmzzq', '{"status":"DRAFT","rollup":null}', '{"status":"SUBMITTED","rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submitted via Data Entry Workspace — Level 2 — Water Management', NULL, NULL, '2026-11-04T11:48:10.024Z'),
  ('cmw2e8cs6000d7ktwt9940a9l', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2e899w-lxbw', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T12:01:21.457Z'),
  ('cmw2eh36q00077kgg0nuf9nwt', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2egzc6-mvp3', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T12:08:08.921Z'),
  ('cmw2f7bxq000h7kgggnrpje6h', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2f78cj-capk', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T12:28:33.518Z'),
  ('cmw2f7nb9000p7kgg869au7i1', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'CREATE', 'Submission', 'cmw2f7lny000n7kggnesw78ox', NULL, '{"projectId":"cmvt5842u002c7kssl8jciq2c","reportingPeriodId":"cmvt6ag9q00087kxwvb2pkxhx","module":"ENERGY","title":"Project — Level 1 — Energy Consumption (June 2026)","recordIds":["rec-l1-mw2f78cj-capk"],"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submission created in DRAFT state', NULL, NULL, '2026-11-04T12:28:48.261Z'),
  ('cmw2f7uf0000r7kggwqo0cw6s', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'Submission', 'cmw2f7lny000n7kggnesw78ox', '{"status":"DRAFT","rollup":null}', '{"status":"SUBMITTED","rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}}', 'Submitted via Data Entry Workspace — Level 1 — Energy Consumption', NULL, NULL, '2026-11-04T12:28:57.467Z'),
  ('cmw2fs8vr0082e9wobihg02v9', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T12:44:49.335Z'),
  ('cmw2ft9xc0089e9wop9v9o6bc', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T12:45:37.344Z'),
  ('cmw2fvvjv008le9wof3u4fxzc', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T12:47:38.683Z'),
  ('cmw2g67h10093e9wobwggishm', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2g62zk-zqtu', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T12:55:40.693Z'),
  ('cmw2g6nu7009fe9wov1ycp8h7', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l2-mw2g6jq6-65zt', NULL, '{"level":2,"levelName":"Level 2 — Water Management","validationStatus":"PASSED","calculation":{"calculatedValue":18300,"resultUnit":"kL Net Withdrawal","scope":"WATER_CIRCULARITY","factorId":"MULTI-WATER-1-SOURCES","methodologyNote":"Multi-source water circularity: 6,200 kL recycled (25.3% circular recovery) across 1 sources (Groundwater (24500 kL)).","sourceValue":24500,"sourceUnit":"kL","normalizedValue":24500,"normalizedUnit":"kL Gross"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T12:56:01.699Z'),
  ('cmw2gwkzi009xe9woi1j34s8u', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2gwgo8-spsx', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T13:16:10.948Z'),
  ('cmw2gxrc000a7e9wo6jovq0d2', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l2-mw2gxlyp-axp4', NULL, '{"level":2,"levelName":"Level 2 — Water Management","validationStatus":"PASSED","calculation":{"calculatedValue":18300,"resultUnit":"kL Net Withdrawal","scope":"WATER_CIRCULARITY","factorId":"MULTI-WATER-1-SOURCES","methodologyNote":"Multi-source water circularity: 6,200 kL recycled (25.3% circular recovery) across 1 sources (Groundwater (24500 kL)).","sourceValue":24500,"sourceUnit":"kL","normalizedValue":24500,"normalizedUnit":"kL Gross"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T13:17:06.145Z'),
  ('cmw2gziuk00awe9wodeiz3f9f', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2gzhom00are9wofih3t440', NULL, '{"levelsSubmitted":9,"project":"HH-300 Automated Hydraulic Rigs Line","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T13:18:28.461Z'),
  ('cmw2gzy3p00b1e9wofubl1160', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2gzhom00are9wofih3t440', NULL, '{"levelsSubmitted":9,"project":"HH-300 Automated Hydraulic Rigs Line","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T13:18:48.229Z'),
  ('cmw2tkikn00157kggnzfije00', 'cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'PROJECT_ADMIN', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2tkcso-wdhd', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:10:43.013Z'),
  ('cmw2ts51t001f7kggi037c37g', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2trzud-tr13', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:16:38.994Z'),
  ('cmw2ttkcd001r7kggv24dhe4e', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2ttfof-s0gf', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:17:45.186Z'),
  ('cmw2ttwqz00217kgglr354js3', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l2-mw2ttrhq-u3iy', NULL, '{"level":2,"levelName":"Level 2 — Water Management","validationStatus":"PASSED","calculation":{"calculatedValue":18300,"resultUnit":"kL Net Withdrawal","scope":"WATER_CIRCULARITY","factorId":"MULTI-WATER-1-SOURCES","methodologyNote":"Multi-source water circularity: 6,200 kL recycled (25.3% circular recovery) across 1 sources (Groundwater (24500 kL)).","sourceValue":24500,"sourceUnit":"kL","normalizedValue":24500,"normalizedUnit":"kL Gross"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:18:01.236Z'),
  ('cmw2tu62s002a7kgguv090g4z', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l3-mw2tu1yo-2ed8', NULL, '{"level":3,"levelName":"Level 3 — GHG Emissions & Air Quality","validationStatus":"PASSED","calculation":{"calculatedValue":324.124,"resultUnit":"tCO2e GHG Total","scope":"SCOPE_1_+_SCOPE_2","factorId":"EMISSION-MASTER-V1","factorVersion":1,"methodologyNote":"Consolidated GHG Protocol Inventory: Scope 1: 49.18 tCO2e, Scope 2: 274.94 tCO2e, Scope 3: 0.00 tCO2e. Air pollutants (1 streams) tracked separately per CPCB norms.","formula":"Sum(Activity Qty × Approved Factor ÷ 1,000) across 2 GHG sources","calculatedAt":"2026-11-05T00:48:08.304Z","sourceValue":402650,"sourceUnit":"litres","normalizedValue":324.124,"normalizedUnit":"tCO2e","lineage":{"ghgItems":[{"source":"DG Sets & Power Generators","scope":"Scope 1 activity","fuel":"Diesel (HSD)","quantity":18650,"unit":"litres","factorName":"Diesel (HSD)","factorValue":2.637,"factorUnit":"kgCO2e/L","factorSource":"IPCC Guidelines 2006 Vol 2 Ch 2","factorVersion":1,"calculatedTco2e":49.18,"sourceRecordId":null},{"source":"Purchased Grid Electricity (Scope 2)","scope":"Scope 2 activity","fuel":"Grid Electricity (India)","quantity":384000,"unit":"kWh","factorName":"Grid Electricity (India)","factorValue":0.716,"factorUnit":"kgCO2e/kWh","factorSource":"CEA CO2 Baseline Database v19","factorVersion":1,"calculatedTco2e":274.944,"sourceRecordId":null}],"airPollutants":[{"source":"Ambient Air Monitoring","pollutant":"PM10 / PM2.5","result":"48.2 µg/m³","location":"Perimeter Air Monitoring Station 01","lab":"Vimta Labs Ltd. / IS 5182 (Part 23)","compliant":true}],"scopeBreakdown":{"scope1Tco2e":49.18,"scope2Tco2e":274.944,"scope3Tco2e":0}}},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:18:13.636Z'),
  ('cmw2tumtl002l7kgg97yv2zkw', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l4-mw2tuhlu-g5iq', NULL, '{"level":4,"levelName":"Level 4 — Waste Management","validationStatus":"PASSED","calculation":{"calculatedValue":91.28,"resultUnit":"% Circular Diversion","scope":"WASTE_CIRCULARITY","factorId":"MULTI-WASTE-1-CATEGORIES","methodologyNote":"Multi-category waste: 17.20 MT generated, 15.70 MT circular diverted (91.3% recovery), 1.50 MT disposed across 1 streams.","sourceValue":17.2,"sourceUnit":"MT","normalizedValue":15.7,"normalizedUnit":"MT Diverted"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:18:35.040Z'),
  ('cmw2tv4bj002v7kggakgupfnz', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l5-mw2tuzm7-bfuw', NULL, '{"level":5,"levelName":"Level 5 — Environmental Permits & Compliance","validationStatus":"PASSED","calculation":{"calculatedValue":100,"resultUnit":"% Regulatory Compliance","scope":"STATUTORY_COMPLIANCE","factorId":"MULTI-PERMIT-1-AUTHORIZATIONS","methodologyNote":"Portfolio of 1 environmental authorizations: 1 active/valid, 0 renewal windows (<90d), 0 non-compliances flagged.","sourceValue":1,"sourceUnit":"Permits","normalizedValue":1,"normalizedUnit":"Valid Authorizations"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:18:57.780Z'),
  ('cmw2tvfg300357kggi4qmut6i', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l6-mw2tvb7x-wva8', NULL, '{"level":6,"levelName":"Level 6 — Environmental Initiatives","validationStatus":"PASSED","calculation":{"calculatedValue":47000,"resultUnit":"Net Resources Conserved (25.4%)","scope":"RESOURCE_EFFICIENCY","factorId":"MULTI-INITIATIVE-1-PROJECTS","methodologyNote":"Portfolio of 1 ESG initiatives: Cumulative baseline 1,85,000 vs reporting 1,38,000. Total conservation: 47,000 (25.4% reduction).","sourceValue":138000,"sourceUnit":"Aggregated Units","normalizedValue":47000,"normalizedUnit":"Conserved Units"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:19:12.435Z');
INSERT INTO "public"."SoAuditLog" ("id", "actorId", "actorName", "actorRole", "action", "entityType", "entityId", "oldState", "newState", "reason", "metadata", "ipAddress", "createdAt") VALUES
  ('cmw2tvww5003e7kgg9gpph575', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T19:19:35.044Z'),
  ('cmw2u3vkd003q7kggmh6bw8gl', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'DataEntryRecord', 'rec-l1-mw2u3qy9-q5xx', NULL, '{"level":1,"levelName":"Level 1 — Energy Consumption","validationStatus":"PASSED","calculation":{"calculatedValue":274.944,"resultUnit":"tCO2e","scope":"SCOPE_2","factorId":"MULTI-SOURCE-1-ITEMS","factorVersion":1,"methodologyNote":"Consolidated multi-source energy calculation (1 sources: Grid electricity (384000 kWh))","normalizedValue":1382.4,"normalizedUnit":"GJ","sourceValue":384000,"sourceUnit":"kWh"},"status":"SUBMITTED"}', 'Source record submitted for Project Admin review', NULL, NULL, '2026-11-04T19:25:46.573Z'),
  ('cmw2u4e1k003w7kgg2epfgzni', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T19:26:10.520Z'),
  ('cmw2u5b8200447kggkue4yzyw', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T19:26:53.522Z'),
  ('cmw2u7x99004c7kgg1wzspy9b', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T19:28:55.389Z'),
  ('cmw2ukbmf004l7kgg9wgisqox', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'PROJECT_USER', 'SUBMIT', 'SubmissionPackage', 'cmw2fs7qi007ye9won2f1ivy8', NULL, '{"levelsSubmitted":9,"project":"Pavagada Mega Solar Complex Expansion","status":"SUBMITTED"}', 'Full site data package submitted to Project Admin at once', NULL, NULL, '2026-11-04T19:38:33.880Z');

-- Table "public"."SoNotification" (2 rows)
INSERT INTO "public"."SoNotification" ("id", "userId", "type", "title", "message", "severity", "read", "linkEntity", "linkId", "createdAt") VALUES
  ('cmvt6cy71004c7kxw5nrrsx86', 'cmvt596uj00017k44uqelt2ry', 'SUBMISSION_DUE', 'June 2026 submission due', 'Energy data for June 2026 is due by 30 Jun.', 'WARNING', FALSE, 'PROJECT', 'cmvt5842u002c7kssl8jciq2c', '2026-06-25T03:30:00.000Z'),
  ('cmvt6cy71004d7kxwgmpr5knq', 'cmvt59gde00077k44q6tymhwf', 'ANOMALY_DETECTED', 'Diesel consumption spike', 'May diesel usage 8% below April — within range.', 'INFO', TRUE, NULL, NULL, '2026-06-02T02:30:00.000Z');

-- Table "public"."SoSubmission" (1 rows)
INSERT INTO "public"."SoSubmission" ("id", "projectId", "reportingPeriodId", "module", "title", "status", "recordIds", "completionPct", "evidenceCount", "validationPassed", "validationErrors", "submittedBy", "submittedAt", "currentReviewerId", "reviewComment", "lockedAt", "lockedBy", "createdAt", "updatedAt") VALUES
  ('cmvt6ct7b003y7kxwaiyjbsp2', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'ENERGY', 'Pavagada Solar Park — Energy April 2026', 'APPROVED', '["cmvt6cbn0002u7kxwnqme7rdj","cmvt6cci6002w7kxw4pkw0m8y","cmvt6cdcj002y7kxwl91xqla1"]', 100, 2, 3, 0, 'cmvt596uj00017k44uqelt2ry', '2026-05-02T18:30:00.000Z', NULL, NULL, NULL, NULL, '2026-10-29T01:10:57.047Z', '2026-10-29T01:10:57.047Z');

-- Table "public"."Submission" (82 rows)
INSERT INTO "public"."Submission" ("id", "ref", "title", "category", "metricName", "metricValue", "metricUnit", "status", "overdue", "period", "fiscalQuarter", "dueDate", "submittedAt", "reviewedAt", "subsidiaryId", "businessUnitId", "projectId", "submittedById", "reviewerId", "values", "evidence", "comments", "history", "module", "recordIds", "reportingPeriodId", "completionPct", "evidenceCount", "validationPassed", "validationErrors", "lockedAt", "lockedBy", "reviewComment", "corrections", "createdAt", "updatedAt") VALUES
  ('cmvt58800005l7ksslksb2epp', 'SUB-2526-006', 'Waste — Hazardous Disposed', 'WASTE', 'Hazardous waste', 46.2, 't', 'CHANGES_REQUESTED', FALSE, 'FY 2025-26', 'Q2', '2026-10-29T23:13:00.000Z', '2026-10-22T22:42:00.000Z', '2026-10-23T22:55:00.000Z', 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt5874800557kss8e044xns', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":46.2,"unit":"t"},{"label":"Prior period","value":43.43,"unit":"t"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-006.pdf","calculation-sheet-006.xlsx"]', '[{"author":"Priya Deshmukh","role":"SUBSIDIARY_ADMIN","text":"Please attach the calibration certificate for the meter used and re-check unit conversion.","at":"2026-10-24T04:25:00.000Z"}]', '[{"action":"Created","actor":"System","at":"2026-10-15T04:28:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-17T03:54:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-19T04:20:00.000Z"},{"action":"Reviewed — changes requested","actor":"Group Admin","at":"2026-10-21T03:46:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.322Z', '2026-10-29T00:39:23.322Z'),
  ('cmvt58801005n7kssqgm62y4r', 'SUB-2526-005', 'Fresh Water Withdrawal & Conservation', 'WATER', 'Water withdrawal', 64200, 'm³', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-06T23:57:00.000Z', '2026-10-14T22:58:00.000Z', '2026-10-15T22:11:00.000Z', 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt5874800537ksse48vrxdf', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":64200,"unit":"m³"},{"label":"Prior period","value":60348,"unit":"m³"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-005.pdf","calculation-sheet-005.xlsx","site-photo-005.jpg"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-05T04:18:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-07T03:44:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-09T04:10:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-11T03:36:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-13T04:02:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.320Z', '2026-10-29T00:39:23.320Z'),
  ('cmvt58803005q7ksspqiaxvnc', 'SUB-2526-008', 'Employee ESG & Safety Training Hours', 'WORKFORCE', 'Training hrs', 14200, 'hrs', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q2', '2026-10-26T22:34:00.000Z', '2026-10-25T22:21:00.000Z', NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n00167kss0csnb7il', 'cmvt5869h004a7kss2vtjxjbn', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":14200,"unit":"hrs"},{"label":"Prior period","value":13348,"unit":"hrs"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-008.pdf","calculation-sheet-008.xlsx","site-photo-008.jpg"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-20T03:33:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-22T03:59:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-24T04:25:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.322Z', '2026-10-29T00:39:23.322Z'),
  ('cmvt58805005t7kssnfw5w036', 'SUB-2526-011', 'Zero Regulatory Non-Compliance Records', 'COMPLIANCE', 'Non-compliance', 0, 'events', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-12T23:15:00.000Z', '2026-10-08T22:40:00.000Z', '2026-10-09T22:53:00.000Z', 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', 'cmvt5842s00227kssdkxf07uj', 'cmvt586ar004i7ksswptmforv', 'cmvt585d8003n7kssg4mcga3d', '[{"label":"Reported value","value":0,"unit":"events"},{"label":"Prior period","value":0,"unit":"events"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-011.pdf","calculation-sheet-011.xlsx","site-photo-011.jpg"]', '[]', '[{"action":"Created","actor":"System","at":"2026-09-29T04:00:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-01T04:26:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-03T03:52:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-05T04:18:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-07T03:44:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.325Z', '2026-10-29T00:39:23.325Z'),
  ('cmvt5880d00607kss8y4rwfso', 'SUB-2526-015', 'Hydro Storage Peak Grid Stabilization', 'ENERGY', 'Peak dispatch', 480, 'MWh', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-10-28T23:00:00.000Z', '2026-10-23T22:55:00.000Z', '2026-10-24T22:08:00.000Z', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', 'cmvt5843v002q7kss3etabcc9', 'cmvt5869s004c7kss7vg6a5sq', 'cmvt5871q004s7kss4jtams2u', '[{"label":"Reported value","value":480,"unit":"MWh"},{"label":"Prior period","value":451.2,"unit":"MWh"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-015.pdf","calculation-sheet-015.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-14T04:15:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-16T03:41:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-18T04:07:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-20T03:33:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-22T03:59:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.337Z', '2026-10-29T00:39:23.337Z'),
  ('cmvt587zu005a7kssiifgxqia', 'SUB-2526-004', 'Renewable Energy Share — Solar Generation', 'ENERGY', 'Renewable share', 78.4, '%', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q2', '2026-10-25T22:21:00.000Z', '2026-10-26T22:34:00.000Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002b7kssxf18hcgj', 'cmvt5869b00487kssxj9r8w83', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":78.4,"unit":"%"},{"label":"Prior period","value":73.7,"unit":"%"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-004.pdf","calculation-sheet-004.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-21T03:46:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-23T04:12:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-25T03:38:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.320Z', '2026-10-29T00:39:23.320Z'),
  ('cmw2ttto6001x7kgg7n8rbgh2', 'PU-mw2tttny-SOAJ', 'Pavagada Mega Solar Complex Expansion — Level 2 — Water Management (June 2026)', 'WATER', 'Total Water Withdrawal', 4900, 'kL', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:26:04.288Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Groundwater","value":"2,500","unit":"kL"},{"label":"Surface Water","value":"1,200","unit":"kL"},{"label":"Municipal Supply","value":"800","unit":"kL"},{"label":"Tankers","value":"400","unit":"kL"},{"label":"Recycled / Reused","value":"1,800","unit":"kL"},{"label":"Zero Liquid Discharge (ZLD)","value":"100% Compliant","unit":""}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793839682877-vykr89","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 2 — Water Management","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:48:02.877Z"}]', 'WATER', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:17:57.558Z', '2026-11-04T19:26:04.288Z'),
  ('cmvt58806005u7ksssve227aj', 'SUB-2526-003', 'Diesel Consumption — Generators & Heavy Equipment', 'ENERGY', 'Diesel', 1284, 'kL', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-03T23:18:00.000Z', '2026-10-17T22:37:00.000Z', '2026-10-18T22:50:00.000Z', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', NULL, 'cmvt5874800557kss8e044xns', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":1284,"unit":"kL"},{"label":"Prior period","value":1206.96,"unit":"kL"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-003.pdf","calculation-sheet-003.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-08T03:57:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-10T04:23:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-12T03:49:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-14T04:15:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-16T03:41:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.327Z', '2026-11-02T10:15:54.854Z'),
  ('cmvt5880d005z7kssyjh2h2md', 'SUB-2526-014', 'Canal-Top Evaporation Water Savings', 'WATER', 'Evaporation saved', 34500, 'm³', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-02T23:05:00.000Z', '2026-10-18T22:50:00.000Z', '2026-10-19T22:03:00.000Z', 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', 'cmvt5842v002i7kssnqny18q2', 'cmvt586at004m7kssfdznrms4', 'cmvt586y5004q7ksshajzpgb0', '[{"label":"Reported value","value":34500,"unit":"m³"},{"label":"Prior period","value":32430,"unit":"m³"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-014.pdf","calculation-sheet-014.xlsx","site-photo-014.jpg"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-09T04:10:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-11T03:36:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-13T04:02:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-15T04:28:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-17T03:54:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.340Z', '2026-10-29T00:39:23.340Z'),
  ('cmvt58800005m7kssp4a42qhj', 'SUB-2526-012', 'Stack Emissions Monitoring — Particulate Matter', 'ENVIRONMENT', 'PM (particulate)', 24.8, 'mg/Nm³', 'DRAFT', FALSE, 'FY 2025-26', 'Q2', '2026-10-24T22:08:00.000Z', NULL, NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt5874800537ksse48vrxdf', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":24.8,"unit":"mg/Nm³"},{"label":"Prior period","value":23.31,"unit":"mg/Nm³"},{"label":"Data points","value":12,"unit":"entries"}]', '[]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-26T03:51:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.325Z', '2026-10-29T00:39:23.325Z'),
  ('cmvt58805005s7kssa06zwg9m', 'SUB-2526-010', 'Community CSR Beneficiaries', 'CSR', 'Beneficiaries', 18400, 'persons', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-10T23:49:00.000Z', '2026-10-10T22:06:00.000Z', '2026-10-11T22:19:00.000Z', 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', 'cmvt5842u002e7ksst5ue6prl', 'cmvt586a2004g7kss0lo08i6q', 'cmvt585d8003n7kssg4mcga3d', '[{"label":"Reported value","value":18400,"unit":"persons"},{"label":"Prior period","value":17296,"unit":"persons"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-010.pdf","calculation-sheet-010.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-01T04:26:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-03T03:52:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-05T04:18:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-07T03:44:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-09T04:10:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.323Z', '2026-10-29T00:39:23.323Z'),
  ('cmvt58801005o7ksske537h8m', 'SUB-2526-002', 'Scope 2 — Purchased Electricity', 'EMISSIONS', 'Scope 2 GHG', 31540, 'tCO2e', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-01T23:52:00.000Z', '2026-10-19T22:03:00.000Z', '2026-10-20T22:16:00.000Z', 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', 'cmvt5874800537ksse48vrxdf', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":31540,"unit":"tCO2e"},{"label":"Prior period","value":29647.6,"unit":"tCO2e"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-002.pdf","calculation-sheet-002.xlsx","site-photo-002.jpg"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-10T04:23:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-12T03:49:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-14T04:15:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-16T03:41:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-18T04:07:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.320Z', '2026-10-29T00:39:23.320Z'),
  ('cmvt58804005r7ksseglfnk92', 'SUB-2526-007', 'Lost Time Injury Frequency Rate (LTIFR)', 'SAFETY', 'LTIFR', 0.28, 'per mn hrs', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-08T23:23:00.000Z', '2026-10-12T22:32:00.000Z', '2026-10-13T22:45:00.000Z', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', 'cmvt583co001y7kssv4sfemdb', 'cmvt5874900567ksssoj7p3zh', 'cmvt585d3003g7kssk4aqkga9', '[{"label":"Reported value","value":0.28,"unit":"per mn hrs"},{"label":"Prior period","value":0.26,"unit":"per mn hrs"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-007.pdf","calculation-sheet-007.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-03T03:52:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-05T04:18:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-07T03:44:00.000Z"},{"action":"Reviewed","actor":"Workflow","at":"2026-10-09T04:10:00.000Z"},{"action":"Approved","actor":"Group Admin","at":"2026-10-11T03:36:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.322Z', '2026-10-29T00:39:23.322Z'),
  ('cmvt5880b005w7kssie1zhb6u', 'SUB-2526-013', 'Scope 3 — Supply Chain Logistics & Travel', 'EMISSIONS', 'Scope 3 travel', 1420, 'tCO2e', 'SUBMITTED', TRUE, 'FY 2025-26', 'Q2', '2026-10-31T23:39:00.000Z', '2026-10-20T22:16:00.000Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, 'cmvt5867h003u7kssnucokg17', 'cmvt585d3003g7kssk4aqkga9', '[{"label":"Reported value","value":1420,"unit":"tCO2e"},{"label":"Prior period","value":1334.8,"unit":"tCO2e"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-013.pdf","calculation-sheet-013.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-15T04:28:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-17T03:54:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-19T04:20:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.333Z', '2026-10-29T00:43:43.290Z'),
  ('cmvt587zy005i7kssynj45zi6', 'SUB-2526-009', 'Supplier Local Sourcing Percentage', 'PROCUREMENT', 'Local sourcing', 72.4, '%', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-10-28T23:00:00.000Z', '2026-10-23T22:55:00.000Z', NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n001a7ksspy772hsr', 'cmvt5869u004e7kss3ia23eko', 'cmvt585cy00387kssujsrm7sk', '[{"label":"Reported value","value":72.4,"unit":"%"},{"label":"Prior period","value":68.06,"unit":"%"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-009.pdf","calculation-sheet-009.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-16T03:41:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-18T04:07:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-20T03:33:00.000Z"},{"action":"Under review","actor":"Workflow","at":"2026-10-22T03:59:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.324Z', '2026-11-02T11:09:03.713Z'),
  ('cmw2u3t0u003m7kggr41hvt48', 'PU-mw2u3t0j-NPGM', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 0, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:25:43.267Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793840147671-pcyj11","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:55:47.671Z"}]', 'ENERGY', '["rec-l1-mw2u3qy9-q5xx"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:25:43.278Z', '2026-11-04T19:25:52.028Z'),
  ('cmvt58801005p7kss9z7gjjny', 'SUB-2526-001', 'Scope 1 — Stationary Combustion Emissions', 'EMISSIONS', 'Scope 1 GHG', 48210, 'tCO2e', 'UNDER_REVIEW', FALSE, 'FY 2025-26', 'Q2', '2026-10-27T22:47:00.000Z', '2026-10-24T22:08:00.000Z', NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', NULL, 'cmvt5874800537ksse48vrxdf', 'cmvt585d1003b7kssa9gqdy4a', '[{"label":"Reported value","value":48210,"unit":"tCO2e"},{"label":"Prior period","value":45317.4,"unit":"tCO2e"},{"label":"Data points","value":12,"unit":"entries"}]', '["meter-log-001.pdf","calculation-sheet-001.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-17T03:54:00.000Z"},{"action":"Assigned","actor":"Workflow","at":"2026-10-19T04:20:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-21T03:46:00.000Z"},{"action":"Under review","actor":"Workflow","at":"2026-10-23T04:12:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:39:23.320Z', '2026-10-29T00:43:40.809Z'),
  ('cmvt5hqbb004t7kvobj1a2df3', 'SUB-2526-901', 'Scope 2 — Purchased Electricity (Renewables)', 'ENERGY', 'Renewable electricity purchased', 4120, 'MWh', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q2', '2026-10-31T07:34:00.000Z', '2026-10-27T23:43:00.000Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, NULL, NULL, '[{"label":"Renewable electricity (open access)","value":2680,"unit":"MWh"},{"label":"I-REC retirement","value":1440,"unit":"MWh"},{"label":"Grid emission factor applied","value":0.71,"unit":"tCO2/MWh"}]', '["open-access-settlement-q2.xlsx","irec-retirement-statement.pdf"]', '[{"author":"Simone Trevisani","role":"SUBSIDIARY_MANAGER","text":"Rejected: I-REC retirement statement was for a different settlement period.\n\nCorrection instructions: Retire certificates for Apr–Jun and re-attach the matching statement.","at":"2026-10-23T08:48:00.000Z"}]', '[{"action":"Created","actor":"System","at":"2026-10-15T02:32:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-20T03:57:00.000Z"},{"action":"Rejected by Rajesh Menon (Subsidiary Manager) — returned for correction","actor":"Simone Trevisani","at":"2026-10-23T08:48:00.000Z","note":"I-REC retirement statement was for a different settlement period."},{"action":"Resubmitted after corrections by Deepa Krishnan","actor":"Workflow","at":"2026-10-28T05:13:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:46:46.729Z', '2026-10-29T00:46:46.729Z'),
  ('cmvt5hree004v7kvo7ez3lvr1', 'SUB-2526-902', 'Groundwater Drawal — Irrigation Pumping', 'WATER', 'Groundwater withdrawn', 1.84, 'ML', 'SUBMITTED', TRUE, 'FY 2025-26', 'Q1', '2026-10-24T06:35:00.000Z', '2026-10-16T23:36:00.000Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', NULL, NULL, NULL, '[{"label":"Groundwater withdrawn (metered)","value":1.62,"unit":"ML"},{"label":"Groundwater withdrawn (estimated)","value":0.22,"unit":"ML"}]', '["groundwater-meter-log-q1.csv"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-09T02:50:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-17T04:06:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:46:48.374Z', '2026-10-29T00:46:48.374Z'),
  ('cmvt5hseu004x7kvot8l3eacr', 'SUB-2526-903', 'GHG Scope 1 — Stationary Combustion', 'EMISSIONS', 'Scope 1 stationary combustion', 984, 'tCO2e', 'UNDER_REVIEW', FALSE, 'FY 2025-26', 'Q2', '2026-11-10T07:24:00.000Z', '2026-10-24T23:52:00.000Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', 'cmvt5836q001w7kssm1wxdsd9', NULL, NULL, '[{"label":"Diesel (gensets)","value":214,"unit":"tCO2e"},{"label":"Furnace oil","value":588,"unit":"tCO2e"},{"label":"Natural gas","value":182,"unit":"tCO2e"}]', '["fuel-consumption-register-q2.xlsx"]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-18T03:23:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-25T06:22:00.000Z"},{"action":"Review started","actor":"Workflow","at":"2026-10-27T02:56:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:46:49.687Z', '2026-10-29T00:46:49.687Z'),
  ('cmvt5htgs004z7kvojjsitca5', 'SUB-2526-904', 'Effluent Quality — Q1 Compliance', 'SAFETY', 'Effluent samples within limits', 96, '%', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-11-06T07:16:00.000Z', '2026-10-25T23:09:00.000Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, NULL, NULL, '[{"label":"Samples collected","value":24,"unit":"count"},{"label":"Within CPCB limits","value":23,"unit":"count"}]', '[]', '[]', '[{"action":"Created","actor":"System","at":"2026-10-20T02:57:00.000Z"},{"action":"Submitted by user","actor":"Workflow","at":"2026-10-26T07:39:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T00:46:51.051Z', '2026-10-29T00:46:51.051Z'),
  ('cmvt632nc00037kj4xf8wyynj', 'SUB-BU-1001-001', 'Stack Emissions — SO₂ Concentration', 'EMISSIONS', 'SO₂', 412.5, 'mg/Nm³', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q2', '2026-11-05T07:13:00.000Z', '2026-10-28T02:41:00.000Z', NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001d7kssswxq54mz', 'cmvt5874800537ksse48vrxdf', NULL, '[{"label":"Reported value","value":412.5,"unit":"mg/Nm³"},{"label":"Prior period","value":398.2,"unit":"mg/Nm³"},{"label":"Data points","value":24,"unit":"entries"}]', '["cemso-report-bu1001-001.pdf","calibration-bu1001-001.pdf"]', '[]', '[{"action":"Created","actor":"Tarun Mehta","at":"2026-10-26T04:33:00.000Z"},{"action":"Assigned to responsible user","actor":"Suresh Babu","at":"2026-10-26T06:33:00.000Z"},{"action":"Submitted by user","actor":"Tarun Mehta","at":"2026-10-28T08:11:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T01:03:22.727Z', '2026-10-29T01:03:22.727Z'),
  ('cmvt634bc00057kj46kasnt5n', 'SUB-BU-1001-002', 'Water Withdrawal — Cooling Tower Makeup', 'WATER', 'Water withdrawal', 18450, 'm³', 'UNDER_REVIEW', TRUE, 'FY 2025-26', 'Q2', '2026-11-05T07:13:00.000Z', '2026-10-22T23:06:00.000Z', NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt5874800537ksse48vrxdf', NULL, '[{"label":"Reported value","value":18450,"unit":"m³"},{"label":"Prior period","value":17120,"unit":"m³"},{"label":"Data points","value":31,"unit":"entries"}]', '["meter-log-bu1001-002.xlsx"]', '[{"author":"Suresh Babu","role":"BU_MANAGER","text":"Verifying water withdrawal consistency against last quarter''s escalation.","at":"2026-10-26T09:33:00.000Z"}]', '[{"action":"Created","actor":"Tarun Mehta","at":"2026-10-21T02:58:00.000Z"},{"action":"Submitted by user","actor":"Tarun Mehta","at":"2026-10-23T04:36:00.000Z"},{"action":"Under review — Suresh Babu","actor":"Suresh Babu","at":"2026-10-25T10:14:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T01:03:24.887Z', '2026-10-29T01:03:24.887Z'),
  ('cmvt6363r00077kj4hzqv3tlr', 'SUB-BU-1001-003', 'Solid Waste — Fly Ash Utilisation', 'WASTE', 'Fly ash utilised', 92.4, '%', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q2', '2026-11-05T07:13:00.000Z', '2026-10-27T03:22:00.000Z', NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001d7kssswxq54mz', 'cmvt5874800537ksse48vrxdf', NULL, '[{"label":"Reported value","value":92.4,"unit":"%"},{"label":"Prior period","value":88.1,"unit":"%"},{"label":"Data points","value":30,"unit":"entries"}]', '[]', '[]', '[{"action":"Created","actor":"Tarun Mehta","at":"2026-10-25T03:14:00.000Z"},{"action":"Submitted by user","actor":"Tarun Mehta","at":"2026-10-27T08:52:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T01:03:27.206Z', '2026-10-29T01:03:27.206Z'),
  ('cmvt637yg00097kj4529bfm54', 'SUB-BU-1001-004', 'Energy Consumed — Auxiliary Power', 'ENERGY', 'Auxiliary power', 8.21, '% of gross', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q2', '2026-11-05T07:13:00.000Z', '2026-10-28T06:41:00.000Z', NULL, 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt5874800537ksse48vrxdf', NULL, '[{"label":"Reported value","value":8.21,"unit":"%"},{"label":"Prior period","value":8.45,"unit":"%"},{"label":"Data points","value":30,"unit":"entries"}]', '["aux-power-bu1001-004.xlsx","calibration-bu1001-004.pdf"]', '[{"author":"Suresh Babu","role":"BU_MANAGER","text":"Please attach the latest energy meter calibration certificate and resubmit.","at":"2026-10-22T10:17:00.000Z"}]', '[{"action":"Created","actor":"Tarun Mehta","at":"2026-10-20T02:39:00.000Z"},{"action":"Submitted by user","actor":"Tarun Mehta","at":"2026-10-21T04:58:00.000Z"},{"action":"Returned for correction — Suresh Babu","actor":"Suresh Babu","at":"2026-10-22T10:17:00.000Z","note":"Missing calibration certificate."},{"action":"Resubmitted by user","actor":"Tarun Mehta","at":"2026-10-28T12:11:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T01:03:29.607Z', '2026-10-29T01:03:29.607Z'),
  ('cmvt63atl000b7kj4hpjpbixi', 'SUB-BU-3002-001', 'Treated Water — Quality Compliance', 'WATER', 'Treated water', 12450, 'm³/day', 'APPROVED', FALSE, 'FY 2025-26', 'Q2', '2026-11-12T07:26:00.000Z', '2026-10-18T23:50:00.000Z', '2026-10-20T02:09:00.000Z', 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'cmvt5836p001l7ksscmzyzwzc', NULL, 'cmvt5872t004u7kssxxuu9alr', '[{"label":"Reported value","value":12450,"unit":"m³/day"},{"label":"Prior period","value":11980,"unit":"m³/day"},{"label":"Data points","value":30,"unit":"entries"}]', '["lab-test-bu3002-001.pdf","log-sheet-bu3002-001.xlsx"]', '[{"author":"Kiran Reddy","role":"BU_ADMIN","text":"Lab test attached — awaiting BU Manager review.","at":"2026-10-19T08:20:00.000Z"}]', '[{"action":"Created","actor":"Lab Analyst","at":"2026-10-17T02:42:00.000Z"},{"action":"Submitted by user","actor":"Lab Analyst","at":"2026-10-19T05:20:00.000Z"},{"action":"Approved by BU Manager","actor":"Prasad Patil","at":"2026-10-20T07:39:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T01:03:33.088Z', '2026-10-29T01:03:33.088Z'),
  ('cmvt63cm6000d7kj4pa8e6so9', 'SUB-BU-3002-002', 'Pipeline Loss — Leakage Volume', 'WATER', 'Pipeline loss', 4.8, '%', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q2', '2026-11-12T07:26:00.000Z', '2026-10-27T02:22:00.000Z', NULL, 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'cmvt5842y002k7kssuwfpe73x', NULL, NULL, '[{"label":"Reported value","value":4.8,"unit":"%"},{"label":"Prior period","value":5.2,"unit":"%"},{"label":"Data points","value":30,"unit":"entries"}]', '["leakage-log-bu3002-002.xlsx"]', '[]', '[{"action":"Created","actor":"Field Engineer","at":"2026-10-25T03:14:00.000Z"},{"action":"Submitted by user","actor":"Field Engineer","at":"2026-10-27T07:52:00.000Z"}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', '2026-10-29T01:03:35.645Z', '2026-10-29T01:03:35.645Z'),
  ('cmw2tukdm002h7kggohh1c9vj', 'PU-mw2tukd9-FAS4', 'Pavagada Mega Solar Complex Expansion — Level 4 — Waste Management (June 2026)', 'WASTE', 'Total Waste Generated', 97, 'MT', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:26:04.288Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Hazardous Waste","value":12.4,"unit":"MT"},{"label":"Non-Hazardous Waste","value":84.6,"unit":"MT"},{"label":"Recycled / Diverted","value":62,"unit":"MT"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793839716665-7g086o","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 4 — Waste Management","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:48:36.665Z"}]', 'WASTE', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:18:32.169Z', '2026-11-04T19:26:04.288Z'),
  ('cmw29mzly000ie9wovwaawe4s', 'PU-mw29mzlv-871D', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T09:52:46.339Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity, Renewable electricity, Diesel, Petrol, Gas, LPG, Coal, Other","unit":""},{"label":"Emission Data Type","value":"Scope 1 & 2","unit":""},{"label":"Energy Activity","value":"Lighting, Office, Generator, Vehicles, Heating / Boiler, Heating / Boiler, Heating / Boiler, Other","unit":""},{"label":"Consumption Quantity","value":"7744168","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV, MEIL-SOLAR-PV-01, MEIL-DG-500KVA-01, MEIL-FLT-PETROL-01, MEIL-GAS-LINE-01, MEIL-LPG-CYL-01, MEIL-BOILER-COAL-01, MEIL-MTR-MISC-01","unit":""},{"label":"Renewable Energy Quantity","value":"602523","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""},{"label":"Source Document","value":"Electricity bill, Meter log, Fuel register, Invoice & Delivery Challan, Invoice & Delivery Challan, Invoice & Delivery Challan, Invoice & Delivery Challan, Other","unit":""},{"label":"Remarks","value":"Fuel/energy record for Other.","unit":""},{"label":"Evidence Id","value":"cmw29ixz1000ee9woshb4lr47","unit":""},{"label":"Total Tco2e","value":18197.038323,"unit":""}]', '[]', '[]', '[{"id":"h-1793805769453-1xpde2","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T15:22:49.453Z"}]', 'ENERGY', '["rec-l1-mw29mw0u-pjk3"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T09:52:46.341Z', '2026-11-04T09:52:57.129Z'),
  ('cmw29no6s000se9woi4mz4ejy', 'PU-mw29no6r-DI0G', 'Project — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T09:53:28.399Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity, Renewable electricity, Diesel, Petrol, Gas, LPG, Coal, Other","unit":""},{"label":"Emission Data Type","value":"Scope 1 & 2","unit":""},{"label":"Energy Activity","value":"Lighting, Office, Generator, Vehicles, Heating / Boiler, Heating / Boiler, Heating / Boiler, Other","unit":""},{"label":"Consumption Quantity","value":"7744168","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV, MEIL-SOLAR-PV-01, MEIL-DG-500KVA-01, MEIL-FLT-PETROL-01, MEIL-GAS-LINE-01, MEIL-LPG-CYL-01, MEIL-BOILER-COAL-01, MEIL-MTR-MISC-01","unit":""},{"label":"Renewable Energy Quantity","value":"602523","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""},{"label":"Source Document","value":"Electricity bill, Meter log, Fuel register, Invoice & Delivery Challan, Invoice & Delivery Challan, Invoice & Delivery Challan, Invoice & Delivery Challan, Other","unit":""},{"label":"Remarks","value":"Fuel/energy record for Other.","unit":""},{"label":"Evidence Id","value":"cmw29ixz1000ee9woshb4lr47","unit":""},{"label":"Total Tco2e","value":18197.038323,"unit":""}]', '[]', '[]', '[{"id":"h-1793805811839-focbcn","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":{"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}},"createdAt":"2026-11-04T15:23:31.839Z"},{"id":"h-1793805827615-orj3yc","fromStatus":"SUBMITTED","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"REVIEW","comment":"Mirrored to platform review chain as PU-cmw29no6s000se9woi4mz4ejy (Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line)","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T15:23:47.615Z"}]', 'ENERGY', '["rec-l1-mw29mw0u-pjk3"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T09:53:18.196Z', '2026-11-04T09:53:47.616Z'),
  ('cmw2ddn90004he9woubp428i6', 'PU-MW2DDN8Z-3D0W', 'Kakinada Rig Assembly & Testing Yard — Level 3 — GHG Emissions & Air Quality (April 2026)', 'EMISSIONS', 'GHG Footprint (Scope 1+2)', 253.6, 'tCO2e', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Scope 1 (Direct Combustion)","value":68.4,"unit":"tCO2e"},{"label":"Scope 2 (Purchased Electricity)","value":185.2,"unit":"tCO2e"},{"label":"Scope 3 (Value Chain)","value":44,"unit":"tCO2e"},{"label":"Total GHG Footprint","value":297.6,"unit":"tCO2e"}]', '[]', '[]', '[]', 'EMISSIONS', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:28.885Z', '2026-11-04T11:38:29.063Z'),
  ('cmw29qhbi0016e9wo8tcmoxp8', 'PU-mw29qhbg-HIUK', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T09:55:29.260Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt59nan000f7k44ov5pssam', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793805932529-bjzjq6","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt59nan000f7k44ov5pssam","actorName":"Er. K. Venkataramana","actorRole":"PROJECT_ADMIN","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T15:25:32.529Z"}]', 'ENERGY', '["rec-l1-mw29qdxl-hb21"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T09:55:29.262Z', '2026-11-04T09:55:40.263Z'),
  ('cmw2azuyd0026e9wo56uimwjc', 'PU-mw2azusb-E2NV', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T10:30:46.235Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Electricity Grid Kwh","value":12500,"unit":""},{"label":"Diesel Dg Liters","value":350,"unit":""},{"label":"Solar Rooftop Kwh","value":4200,"unit":""},{"label":"Comments","value":"Verified automated benchmark entry","unit":""}]', '[]', '[]', '[{"id":"h-1793808053956-exga3p","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T16:00:53.956Z"}]', 'ENERGY', '["rec-l1-mw2azp7d-glz0"]', 'cmvt6acpg00047kxwgjmt06r8', 50, 0, 0, 1, NULL, NULL, NULL, '[]', '2026-11-04T10:30:46.237Z', '2026-11-04T10:30:57.815Z'),
  ('cmw29rhe5001ge9wo5yykjkdc', 'PU-mw29rhe4-FODI', 'Project — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T09:56:24.629Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt59nan000f7k44ov5pssam', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793805988025-o8ii3a","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt59nan000f7k44ov5pssam","actorName":"Er. K. Venkataramana","actorRole":"PROJECT_ADMIN","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":{"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}},"createdAt":"2026-11-04T15:26:28.025Z"},{"id":"h-1793806005231-ztoit8","fromStatus":"SUBMITTED","toStatus":"SUBMITTED","actorId":"cmvt59nan000f7k44ov5pssam","actorName":"Er. K. Venkataramana","actorRole":"PROJECT_ADMIN","action":"REVIEW","comment":"Mirrored to platform review chain as PU-cmw29rhe5001ge9wo5yykjkdc (Drillmec S.p.A. · Advanced Rig Automation & Manufacturing · HH-300 Automated Hydraulic Rigs Line)","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T15:26:45.231Z"}]', 'ENERGY', '["rec-l1-mw29qdxl-hb21"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T09:56:16.013Z', '2026-11-04T09:56:45.233Z'),
  ('cmw2ddl9o004fe9wodhi19igp', 'PU-MW2DDL9N-JRLG', 'Kakinada Rig Assembly & Testing Yard — Level 2 — Water Management (April 2026)', 'WATER', 'Total Water Withdrawal', 7600, 'kL', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Groundwater","value":"4,200","unit":"kL"},{"label":"Surface Water","value":"1,900","unit":"kL"},{"label":"Municipal Supply","value":"1,100","unit":"kL"},{"label":"Tankers","value":"400","unit":"kL"},{"label":"Recycled / Reused","value":"2,400","unit":"kL"},{"label":"Zero Liquid Discharge (ZLD)","value":"100% Compliant","unit":""}]', '[]', '[]', '[]', 'WATER', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:26.317Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2b0m0a002ie9wogv9b3480', 'PU-mw2b0m09-QUM8', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (April 2026)', 'ENERGY', '', 0, '', 'APPROVED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T10:31:21.513Z', '2026-11-04T11:49:20.028Z', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'cmvt596uj00017k44uqelt2ry', '[{"label":"Electricity Grid Kwh","value":12500,"unit":""},{"label":"Diesel Dg Liters","value":350,"unit":""},{"label":"Solar Rooftop Kwh","value":4200,"unit":""},{"label":"Comments","value":"Verified automated benchmark entry","unit":""}]', '[]', '[]', '[{"id":"h-1793808085836-6vumls","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T16:01:25.836Z"}]', 'ENERGY', '["rec-l1-mw2b0i0e-43x8"]', 'cmvt6acpg00047kxwgjmt06r8', 50, 0, 0, 1, NULL, NULL, 'Approved by Project Admin.', '[]', '2026-11-04T10:31:21.515Z', '2026-11-04T11:49:20.028Z'),
  ('cmw2ddp10004je9wo6ypgrdbg', 'PU-MW2DDP0Y-60KS', 'Kakinada Rig Assembly & Testing Yard — Level 4 — Waste Management (April 2026)', 'WASTE', 'Total Waste Generated', 130.7, 'MT', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Hazardous Waste","value":18.2,"unit":"MT"},{"label":"Non-Hazardous Waste","value":112.5,"unit":"MT"},{"label":"Recycled / Diverted","value":89,"unit":"MT"}]', '[]', '[]', '[]', 'WASTE', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:31.188Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2bz902003pe9woj09b1z3y', 'PU-mw2bz900-LMMG', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T10:58:17.616Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793809702291-a85aw4","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T16:28:22.291Z"}]', 'ENERGY', '["rec-l1-mw2bz7fs-4e67"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T10:58:17.618Z', '2026-11-04T10:58:26.616Z'),
  ('cmw2bzjcu003ye9wodl8r6lvz', 'PU-mw2bzjct-Y0J9', 'Project — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T10:58:40.643Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793809724553-d2uetp","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":{"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}},"createdAt":"2026-11-04T16:28:44.553Z"}]', 'ENERGY', '["rec-l1-mw2bz7fs-4e67"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T10:58:31.039Z', '2026-11-04T10:58:48.441Z'),
  ('cmw2b3pd40030e9wof2blenck', 'PU-mw2b3pd3-N7LM', 'Kakinada Rig Assembly & Testing Yard — Level 1 — Energy Consumption (April 2026)', 'ENERGY', 'Total Energy Consumption', 148.02, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', '2026-11-04T10:37:09.329Z', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', 'cmvt59nan000f7k44ov5pssam', '[{"label":"Grid Electricity","value":"25,000","unit":"kWh"},{"label":"Diesel (DG Sets)","value":"750","unit":"Liters"},{"label":"Rooftop Solar","value":"8,200","unit":"kWh"},{"label":"Total Energy (Normalized)","value":"148.02","unit":"GJ"}]', '[]', '[]', '[{"id":"h-1793808232719-zhqzek","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T16:03:52.719Z"}]', 'ENERGY', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, 0, 1, 0, NULL, NULL, 'Verified and approved by Project Admin Er. K. Venkataramana', '[]', '2026-11-04T10:33:45.832Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2ddxwu004te9wo1cacgqsj', 'PU-MW2DDXWT-PRB4', 'Kakinada Rig Assembly & Testing Yard — Level 9 — Energy & Environmental Initiatives (April 2026)', 'CSR', 'Energy Conservation Initiatives', 3, 'programs', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Solar Rooftop Addition","value":"5.1 MW Capacity","unit":""},{"label":"LED Retrofit Phase II","value":"18% Energy Savings","unit":""},{"label":"VFD Compressor Upgrades","value":"Active","unit":""}]', '[]', '[]', '[]', 'INITIATIVES', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:42.703Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2ddw7w004re9woeh2ntjme', 'PU-MW2DDW7V-E238', 'Kakinada Rig Assembly & Testing Yard — Level 8 — Environmental Incidents & Grievances (April 2026)', 'SAFETY', 'Environmental Grievances', 0, 'open', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Open Grievances","value":0,"unit":""},{"label":"Resolved & Closed Cases","value":6,"unit":""},{"label":"Grievance Resolution Rate","value":100,"unit":"%"}]', '[]', '[]', '[]', 'INCIDENTS', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:40.508Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2ddulz004pe9wo11g636fq', 'PU-MW2DDULY-1C3C', 'Kakinada Rig Assembly & Testing Yard — Level 7 — Environmental Permits & Compliance (April 2026)', 'COMPLIANCE', 'Permits & Regulatory Approvals', 14, 'active', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Consent to Operate (CTO)","value":"Active & Verified","unit":""},{"label":"Consent to Establish (CTE)","value":"Active","unit":""},{"label":"EIA Clearance","value":"Compliant","unit":""},{"label":"Total Verified Permits","value":14,"unit":"permits"}]', '[]', '[]', '[]', 'COMPLIANCE', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:38.423Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2ddqln004le9wom5bdco5x', 'PU-MW2DDQLL-QWJY', 'Kakinada Rig Assembly & Testing Yard — Level 5 — Health & Safety (April 2026)', 'SAFETY', 'Lost Time Injuries (LTI)', 0, 'incidents', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Fatalities","value":0,"unit":""},{"label":"Lost Time Incidents","value":0,"unit":""},{"label":"Man-Hours Worked","value":"3,20,000","unit":"hrs"},{"label":"Safety Training","value":"1,850","unit":"hrs"}]', '[]', '[]', '[]', 'SAFETY', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:33.227Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2ddstj004ne9woq1y1u79i', 'PU-MW2DDSTI-7F76', 'Kakinada Rig Assembly & Testing Yard — Level 6 — Training & Workforce Well-being (April 2026)', 'WORKFORCE', 'Total Active Workforce', 1620, 'personnel', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Permanent Staff","value":"380","unit":""},{"label":"Contract Workers","value":"1,240","unit":""},{"label":"Total Site Headcount","value":"1,620","unit":"personnel"}]', '[]', '[]', '[]', 'TRAINING', '[null]', 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:37:36.103Z', '2026-11-04T11:38:29.063Z'),
  ('cmw2ddzhr004ve9womqlso1he', 'DOS-PRJ-KKD-RIG-MW2DDZHQ', 'Kakinada Rig Assembly & Testing Yard — Complete Site ESG Disclosure Package (April 2026)', 'ENVIRONMENT', 'Consolidated Site Disclosures', 9, 'Levels Completed', 'APPROVED', FALSE, 'FY 2025-26', 'Q1', '2026-04-30T18:29:59.000Z', '2026-11-04T11:38:29.063Z', '2026-11-04T11:44:14.910Z', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt596uj00017k44uqelt2ry', 'cmvt59nan000f7k44ov5pssam', '[{"label":"Energy Consumption","value":"148.02 GJ"},{"label":"Water Management","value":"7600 kL"},{"label":"GHG Emissions & Air Quality","value":"253.6 tCO2e"},{"label":"Waste Management","value":"130.7 MT"},{"label":"Health & Safety","value":"0 incidents"},{"label":"Training & Workforce Well-being","value":"1620 personnel"},{"label":"Environmental Permits & Compliance","value":"14 active"},{"label":"Environmental Incidents & Grievances","value":"0 open"},{"label":"Energy & Environmental Initiatives","value":"3 programs"}]', '[]', '[]', '[]', 'ALL_LEVELS', NULL, 'cmvt6acpg00047kxwgjmt06r8', 100, NULL, 9, 0, NULL, NULL, 'Approved by Project Admin.', '[]', '2026-11-04T11:37:44.751Z', '2026-11-04T11:44:14.910Z'),
  ('cmw2dnelx005ie9wo3l8gpzhe', 'PU-mw2dnelv-AHR7', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 0, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T11:45:04.243Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793812507632-vph956","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T17:15:07.632Z"}]', 'ENERGY', '["rec-l1-mw2dncyl-nbzd"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:45:04.245Z', '2026-11-04T11:45:12.038Z'),
  ('cmw2dns7e005se9wo5c830bwd', 'PU-mw2dns7c-1N3D', 'Project — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T11:45:32.829Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793812536209-0rd5dy","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":{"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}},"createdAt":"2026-11-04T17:15:36.209Z"}]', 'ENERGY', '["rec-l1-mw2dncyl-nbzd"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:45:21.866Z', '2026-11-04T11:45:40.525Z'),
  ('cmw2dotyg0064e9womt3d1upm', 'PU-mw2dotyd-JGJL', 'Project — Level 1 — Energy Consumption (June 2026)', 'ENERGY', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T11:46:17.879Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793812581789-pl3hu8","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":{"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":1,"completionPct":100}},"createdAt":"2026-11-04T17:16:21.789Z"}]', 'ENERGY', '["rec-l1-mw2dncyl-nbzd"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:46:10.792Z', '2026-11-04T11:46:25.787Z'),
  ('cmw2dqxpb006ge9woeof9pfn2', 'PU-mw2dqxpa-FG1Q', 'HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'WATER', 'Total Water Withdrawal', 0, 'kL', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T11:47:48.958Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Water Source","value":"Groundwater","unit":""},{"label":"Water Activity","value":"Withdrawal","unit":""},{"label":"Water Quantity","value":"24500","unit":""},{"label":"Unit","value":"kL","unit":""},{"label":"Meter Source Id","value":"CGWA-BW-01-MTR","unit":""},{"label":"Opening Reading","value":"82400","unit":""},{"label":"Closing Reading","value":"106900","unit":""},{"label":"Water Reused Recycled","value":"6200","unit":""},{"label":"Discharge Destination","value":"Zero Liquid Discharge (ZLD)","unit":""},{"label":"Treatment Level","value":"RO / ZLD","unit":""},{"label":"Water Quality Result","value":"TDS: 420 mg/L, pH: 7.2 (Compliant)","unit":""},{"label":"Test Date Lab","value":"2026-09-15 · SGS Environmental Testing","unit":""}]', '[]', '[]', '[{"id":"h-1793812672463-4tirlv","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 2 — Water Management","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T17:17:52.463Z"}]', 'WATER', '["rec-l2-mw2dqvql-lrte"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:47:48.959Z', '2026-11-04T11:47:56.372Z');
INSERT INTO "public"."Submission" ("id", "ref", "title", "category", "metricName", "metricValue", "metricUnit", "status", "overdue", "period", "fiscalQuarter", "dueDate", "submittedAt", "reviewedAt", "subsidiaryId", "businessUnitId", "projectId", "submittedById", "reviewerId", "values", "evidence", "comments", "history", "module", "recordIds", "reportingPeriodId", "completionPct", "evidenceCount", "validationPassed", "validationErrors", "lockedAt", "lockedBy", "reviewComment", "corrections", "createdAt", "updatedAt") VALUES
  ('cmw2f7lny000n7kggnesw78ox', 'PU-mw2f7lnr-FG5U', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 1584.24, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:45:33.329Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Grid Electricity","value":"3,84,000","unit":"kWh"},{"label":"Diesel (DG Sets)","value":"480","unit":"Liters"},{"label":"Rooftop Solar","value":"51,000","unit":"kWh"},{"label":"Total Energy (Normalized)","value":"1,584.24","unit":"GJ"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793815138635-gv6709","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":{"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}},"createdAt":"2026-11-04T17:58:58.636Z"}]', 'ENERGY', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:28:46.126Z', '2026-11-04T12:45:33.329Z'),
  ('cmw2fs5ie007te9wo6rorpq98', 'PU-MW2FS5I8-7ZSN', 'Pavagada Mega Solar Complex Expansion — Level 7 — Environmental Permits & Compliance (June 2026)', 'COMPLIANCE', 'Permits & Regulatory Approvals', 14, 'active', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:47:35.021Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Consent to Operate (CTO)","value":"Active & Verified","unit":""},{"label":"Consent to Establish (CTE)","value":"Active","unit":""},{"label":"EIA Clearance","value":"Compliant","unit":""},{"label":"Total Verified Permits","value":14,"unit":"permits"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'COMPLIANCE', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T12:47:35.021Z'),
  ('cmw2dr4n7006ne9woeykdmzzq', 'PU-mw2dr4n5-JRX2', 'Project — Level 2 — Water Management (June 2026)', 'WATER', '', 0, '', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T11:48:07.226Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Water Source","value":"Groundwater","unit":""},{"label":"Water Activity","value":"Withdrawal","unit":""},{"label":"Water Quantity","value":"24500","unit":""},{"label":"Unit","value":"kL","unit":""},{"label":"Meter Source Id","value":"CGWA-BW-01-MTR","unit":""},{"label":"Opening Reading","value":"82400","unit":""},{"label":"Closing Reading","value":"106900","unit":""},{"label":"Water Reused Recycled","value":"6200","unit":""},{"label":"Discharge Destination","value":"Zero Liquid Discharge (ZLD)","unit":""},{"label":"Treatment Level","value":"RO / ZLD","unit":""},{"label":"Water Quality Result","value":"TDS: 420 mg/L, pH: 7.2 (Compliant)","unit":""},{"label":"Test Date Lab","value":"2026-09-15 · SGS Environmental Testing","unit":""}]', '[]', '[]', '[{"id":"h-1793812691028-2xs7de","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 2 — Water Management","reason":null,"oldValues":null,"newValues":{"rollup":{"total":1,"validationPassed":1,"validationErrors":0,"evidenceCount":0,"completionPct":100}},"createdAt":"2026-11-04T17:18:11.028Z"}]', 'WATER', '["rec-l2-mw2dqvql-lrte"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T11:47:57.955Z', '2026-11-04T11:48:15.390Z'),
  ('cmw2e8awm00097ktw9iiiwgl9', 'PU-mw2e8awh-TM5J', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 0, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:01:19.217Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793813482684-c8irjn","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T17:31:22.684Z"}]', 'ENERGY', '["rec-l1-mw2e899w-lxbw"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:01:19.222Z', '2026-11-04T12:01:25.745Z'),
  ('cmw2eh1aq00037kggbe6w0yqw', 'PU-mw2eh1am-2TP6', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 0, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:08:06.670Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793813890133-jb9yr7","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T17:38:10.133Z"}]', 'ENERGY', '["rec-l1-mw2egzc6-mvp3"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:08:06.674Z', '2026-11-04T12:08:13.747Z'),
  ('cmw2f7a9t000d7kggf57ezatm', 'PU-mw2f7a9n-4DPW', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 1584.24, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:47:35.021Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Grid Electricity","value":"3,84,000","unit":"kWh"},{"label":"Diesel (DG Sets)","value":"480","unit":"Liters"},{"label":"Rooftop Solar","value":"51,000","unit":"kWh"},{"label":"Total Energy (Normalized)","value":"1,584.24","unit":"GJ"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793815115870-gnhscg","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T17:58:35.870Z"}]', 'ENERGY', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:28:31.361Z', '2026-11-04T12:47:35.021Z'),
  ('cmw2fs5ie007ue9woq42jknb7', 'PU-MW2FS5I9-3G2X', 'Pavagada Mega Solar Complex Expansion — Level 8 — Environmental Incidents & Grievances (June 2026)', 'SAFETY', 'Environmental Grievances', 0, 'open', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Open Grievances","value":0,"unit":""},{"label":"Resolved & Closed Cases","value":6,"unit":""},{"label":"Grievance Resolution Rate","value":100,"unit":"%"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'INCIDENTS', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2fs5ie007ne9wo3h7zg3h5', 'PU-MW2FS5I3-T5SN', 'Pavagada Mega Solar Complex Expansion — Level 4 — Waste Management (June 2026)', 'WASTE', 'Total Waste Generated', 97, 'MT', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Hazardous Waste","value":12.4,"unit":"MT"},{"label":"Non-Hazardous Waste","value":84.6,"unit":"MT"},{"label":"Recycled / Diverted","value":62,"unit":"MT"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'WASTE', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2fs5id007ke9wowj3p6j53', 'PU-MW2FS5I1-H5P3', 'Pavagada Mega Solar Complex Expansion — Level 3 — GHG Emissions & Air Quality (June 2026)', 'EMISSIONS', 'GHG Footprint (Scope 1+2)', 262.7, 'tCO2e', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:47:35.021Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Scope 1 (Direct Combustion)","value":74.2,"unit":"tCO2e"},{"label":"Scope 2 (Purchased Electricity)","value":188.5,"unit":"tCO2e"},{"label":"Scope 3 (Value Chain)","value":46,"unit":"tCO2e"},{"label":"Total GHG Footprint","value":308.7,"unit":"tCO2e"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'EMISSIONS', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T12:47:35.021Z'),
  ('cmw2fs5ie007we9wo0flzgsx7', 'PU-MW2FS5IB-LV4I', 'Pavagada Mega Solar Complex Expansion — Level 9 — Energy & Environmental Initiatives (June 2026)', 'CSR', 'Energy Conservation Initiatives', 3, 'programs', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:47:35.021Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Solar Rooftop Addition","value":"5.1 MW Capacity","unit":""},{"label":"LED Retrofit Phase II","value":"18% Energy Savings","unit":""},{"label":"VFD Compressor Upgrades","value":"Active","unit":""}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'INITIATIVES', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T12:47:35.021Z'),
  ('cmw2fs7qi007ye9won2f1ivy8', 'DOS-PRJ-PVG-SOL-MW2FS7QG', 'Pavagada Mega Solar Complex Expansion — Complete Site ESG Disclosure Package (June 2026)', 'ENVIRONMENT', 'Consolidated Site Disclosures', 9, 'Levels Completed', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Consumption","value":"87.72 GJ"},{"label":"Water Management","value":"4900 kL"},{"label":"GHG Emissions & Air Quality","value":"161.2 tCO2e"},{"label":"Waste Management","value":"97 MT"},{"label":"Health & Safety","value":"0 incidents"},{"label":"Training & Workforce Well-being","value":"1620 personnel"},{"label":"Environmental Permits & Compliance","value":"14 active"},{"label":"Environmental Incidents & Grievances","value":"0 open"},{"label":"Energy & Environmental Initiatives","value":"3 programs"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'ALL_LEVELS', NULL, 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 9, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:47.850Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2fs5id007je9wo83vl1fu9', 'PU-MW2FS5HZ-4BQ2', 'Pavagada Mega Solar Complex Expansion — Level 2 — Water Management (June 2026)', 'WATER', 'Total Water Withdrawal', 4900, 'kL', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Groundwater","value":"2,500","unit":"kL"},{"label":"Surface Water","value":"1,200","unit":"kL"},{"label":"Municipal Supply","value":"800","unit":"kL"},{"label":"Tankers","value":"400","unit":"kL"},{"label":"Recycled / Reused","value":"1,800","unit":"kL"},{"label":"Zero Liquid Discharge (ZLD)","value":"100% Compliant","unit":""}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'WATER', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2fs5ie007re9woorui2vht', 'PU-MW2FS5I6-J9HM', 'Pavagada Mega Solar Complex Expansion — Level 6 — Training & Workforce Well-being (June 2026)', 'WORKFORCE', 'Total Active Workforce', 1620, 'personnel', 'APPROVED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', '2026-11-04T19:39:05.371Z', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', 'cmvt59nan000f7k44ov5pssam', '[{"label":"Permanent Staff","value":"380","unit":""},{"label":"Contract Workers","value":"1,240","unit":""},{"label":"Total Site Headcount","value":"1,620","unit":"personnel"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'TRAINING', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, 'Approved by Project Admin.', '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T19:39:05.371Z'),
  ('cmw2fs5ie007qe9wotqg8hhgv', 'PU-MW2FS5I5-BFUM', 'Pavagada Mega Solar Complex Expansion — Level 5 — Health & Safety (June 2026)', 'SAFETY', 'Lost Time Injuries (LTI)', 0, 'incidents', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Fatalities","value":0,"unit":""},{"label":"Lost Time Incidents","value":0,"unit":""},{"label":"Man-Hours Worked","value":"2,48,000","unit":"hrs"},{"label":"Safety Training","value":"1,420","unit":"hrs"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[]', 'SAFETY', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:44:44.966Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2g658j0091e9wo140rnqhl', 'PU-mw2g658h-D31C', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 0, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:55:37.793Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793816741892-sine5z","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T18:25:41.892Z"}]', 'ENERGY', '["rec-l1-mw2g62zk-zqtu"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:55:37.796Z', '2026-11-04T12:55:46.163Z'),
  ('cmw2g6ll0009be9wob6zi3c7x', 'PU-mw2g6lkx-NUY2', 'HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'WATER', 'Total Water Withdrawal', 0, 'kL', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T12:55:58.977Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Water Source","value":"Groundwater","unit":""},{"label":"Water Activity","value":"Withdrawal","unit":""},{"label":"Water Quantity","value":"24500","unit":""},{"label":"Unit","value":"kL","unit":""},{"label":"Meter Source Id","value":"CGWA-BW-01-MTR","unit":""},{"label":"Opening Reading","value":"82400","unit":""},{"label":"Closing Reading","value":"106900","unit":""},{"label":"Water Reused Recycled","value":"6200","unit":""},{"label":"Discharge Destination","value":"Zero Liquid Discharge (ZLD)","unit":""},{"label":"Treatment Level","value":"RO / ZLD","unit":""},{"label":"Water Quality Result","value":"TDS: 420 mg/L, pH: 7.2 (Compliant)","unit":""},{"label":"Test Date Lab","value":"2026-09-15 · SGS Environmental Testing","unit":""}]', '[]', '[]', '[{"id":"h-1793816762934-iilo6x","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 2 — Water Management","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T18:26:02.934Z"}]', 'WATER', '["rec-l2-mw2g6jq6-65zt"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T12:55:58.980Z', '2026-11-04T12:56:07.319Z'),
  ('cmw2gwiom009te9wopvdyyjhz', 'PU-mw2gwioj-B6FR', 'HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 87.72, 'GJ', 'APPROVED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', '2026-11-04T13:44:10.276Z', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', 'cmvt59nan000f7k44ov5pssam', '[{"label":"Grid Electricity","value":"14,200","unit":"kWh"},{"label":"Diesel (DG Sets)","value":"480","unit":"Liters"},{"label":"Rooftop Solar","value":"5,100","unit":"kWh"},{"label":"Total Energy (Normalized)","value":"87.72","unit":"GJ"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[{"id":"h-1793817972758-02m4xb","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T18:46:12.758Z"}]', 'ENERGY', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, 'All calibration certificates and meter logs verified. Fully approved by Project Admin.', '[]', '2026-11-04T13:16:08.278Z', '2026-11-04T13:44:10.276Z'),
  ('cmw2gzf3q00afe9wov32rtqwa', 'PU-MW2GZF2P-6CDT', 'HH-300 Automated Hydraulic Rigs Line — Level 4 — Waste Management (June 2026)', 'WASTE', 'Total Waste Generated', 97, 'MT', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Hazardous Waste","value":12.4,"unit":"MT"},{"label":"Non-Hazardous Waste","value":84.6,"unit":"MT"},{"label":"Recycled / Diverted","value":62,"unit":"MT"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'WASTE', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:23.606Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gxpd000a3e9wosu5x16x5', 'PU-mw2gxpcy-I2S3', 'HH-300 Automated Hydraulic Rigs Line — Level 2 — Water Management (June 2026)', 'WATER', 'Total Water Withdrawal', 4900, 'kL', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Groundwater","value":"2,500","unit":"kL"},{"label":"Surface Water","value":"1,200","unit":"kL"},{"label":"Municipal Supply","value":"800","unit":"kL"},{"label":"Tankers","value":"400","unit":"kL"},{"label":"Recycled / Reused","value":"1,800","unit":"kL"},{"label":"Zero Liquid Discharge (ZLD)","value":"100% Compliant","unit":""}]', '["VID 20261026 051852 188.pdf"]', '[]', '[{"id":"h-1793818027421-ym645m","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 2 — Water Management","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-04T18:47:07.421Z"}]', 'WATER', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:17:03.588Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gzfbx00ahe9woz0lsrihp', 'PU-MW2GZF3D-FLXF', 'HH-300 Automated Hydraulic Rigs Line — Level 8 — Environmental Incidents & Grievances (June 2026)', 'SAFETY', 'Environmental Grievances', 0, 'open', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Open Grievances","value":0,"unit":""},{"label":"Resolved & Closed Cases","value":6,"unit":""},{"label":"Grievance Resolution Rate","value":100,"unit":"%"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'INCIDENTS', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:23.607Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gzgos00aoe9wolj3ukccr', 'PU-MW2GZF30-1A3A', 'HH-300 Automated Hydraulic Rigs Line — Level 6 — Training & Workforce Well-being (June 2026)', 'WORKFORCE', 'Total Active Workforce', 1620, 'personnel', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Permanent Staff","value":"380","unit":""},{"label":"Contract Workers","value":"1,240","unit":""},{"label":"Total Site Headcount","value":"1,620","unit":"personnel"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'TRAINING', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:23.606Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gzgos00ape9wo9k4fnps8', 'PU-MW2GZF2V-GW6E', 'HH-300 Automated Hydraulic Rigs Line — Level 5 — Health & Safety (June 2026)', 'SAFETY', 'Lost Time Injuries (LTI)', 0, 'incidents', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Fatalities","value":0,"unit":""},{"label":"Lost Time Incidents","value":0,"unit":""},{"label":"Man-Hours Worked","value":"2,48,000","unit":"hrs"},{"label":"Safety Training","value":"1,420","unit":"hrs"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'SAFETY', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:23.606Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gzhom00are9wofih3t440', 'DOS-PRJ-RIG-HH300-MW2GZHOK', 'HH-300 Automated Hydraulic Rigs Line — Complete Site ESG Disclosure Package (June 2026)', 'ENVIRONMENT', 'Consolidated Site Disclosures', 9, 'Levels Completed', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Consumption","value":"87.72 GJ"},{"label":"Water Management","value":"4900 kL"},{"label":"GHG Emissions & Air Quality","value":"161.2 tCO2e"},{"label":"Waste Management","value":"97 MT"},{"label":"Health & Safety","value":"0 incidents"},{"label":"Training & Workforce Well-being","value":"1620 personnel"},{"label":"Environmental Permits & Compliance","value":"14 active"},{"label":"Environmental Incidents & Grievances","value":"0 open"},{"label":"Energy & Environmental Initiatives","value":"3 programs"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'ALL_LEVELS', NULL, 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 9, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:26.950Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gzf3p00aee9woov1o3k7u', 'PU-MW2GZF2N-U7YT', 'HH-300 Automated Hydraulic Rigs Line — Level 3 — GHG Emissions & Air Quality (June 2026)', 'EMISSIONS', 'GHG Footprint (Scope 1+2)', 161.2, 'tCO2e', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Scope 1 (Direct Combustion)","value":42.8,"unit":"tCO2e"},{"label":"Scope 2 (Purchased Electricity)","value":118.4,"unit":"tCO2e"},{"label":"Scope 3 (Value Chain)","value":26.2,"unit":"tCO2e"},{"label":"Total GHG Footprint","value":187.4,"unit":"tCO2e"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'EMISSIONS', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:23.606Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gzgos00ane9wotg8ujykg', 'PU-MW2GZF3J-NM5U', 'HH-300 Automated Hydraulic Rigs Line — Level 9 — Energy & Environmental Initiatives (June 2026)', 'CSR', 'Energy Conservation Initiatives', 3, 'programs', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Solar Rooftop Addition","value":"5.1 MW Capacity","unit":""},{"label":"LED Retrofit Phase II","value":"18% Energy Savings","unit":""},{"label":"VFD Compressor Upgrades","value":"Active","unit":""}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'INITIATIVES', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:23.607Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2gzgos00ame9wo7y3jl6yu', 'PU-MW2GZF38-COSP', 'HH-300 Automated Hydraulic Rigs Line — Level 7 — Environmental Permits & Compliance (June 2026)', 'COMPLIANCE', 'Permits & Regulatory Approvals', 14, 'active', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T13:18:43.532Z', NULL, 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Consent to Operate (CTO)","value":"Active & Verified","unit":""},{"label":"Consent to Establish (CTE)","value":"Active","unit":""},{"label":"EIA Clearance","value":"Compliant","unit":""},{"label":"Total Verified Permits","value":14,"unit":"permits"}]', '["VID 20261026 051852 188.pdf"]', '[]', '[]', 'COMPLIANCE', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 1, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T13:18:23.606Z', '2026-11-04T13:18:43.532Z'),
  ('cmw2tkfqc00117kggxawfmxi8', 'PU-mw2tkfq7-LFTE', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 0, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:10:39.583Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt59nan000f7k44ov5pssam', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793839244607-gd4yrm","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt59nan000f7k44ov5pssam","actorName":"Er. K. Venkataramana","actorRole":"PROJECT_ADMIN","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:40:44.607Z"}]', 'ENERGY', '["rec-l1-mw2tkcso-wdhd"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:10:39.587Z', '2026-11-04T19:10:50.084Z'),
  ('cmw2ts2dq001d7kgg8z5g9fdp', 'PU-mw2ts2dj-JWJ3', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 0, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:16:35.527Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Energy Source","value":"Grid electricity","unit":""},{"label":"Emission Data Type","value":"Scope 2","unit":""},{"label":"Energy Activity","value":"Lighting","unit":""},{"label":"Consumption Quantity","value":"384000","unit":""},{"label":"Unit","value":"kWh","unit":""},{"label":"Meter Equipment Id","value":"MEIL-MTR-GRID-400KV","unit":""},{"label":"Opening Meter Reading","value":"124500","unit":""},{"label":"Closing Meter Reading","value":"508500","unit":""},{"label":"Energy Purchased","value":"384000","unit":""},{"label":"Energy Generated","value":"510000","unit":""},{"label":"Renewable Energy Quantity","value":"510000","unit":""},{"label":"Reporting Period","value":"FY 2026-27 (Annual)","unit":""}]', '[]', '[]', '[{"id":"h-1793839600647-5e1rqo","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:46:40.647Z"}]', 'ENERGY', '["rec-l1-mw2trzud-tr13"]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 0, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:16:35.534Z', '2026-11-04T19:16:45.791Z'),
  ('cmw2tu32n00247kggx7xvcsjh', 'PU-mw2tu32b-C7LG', 'Pavagada Mega Solar Complex Expansion — Level 3 — GHG Emissions & Air Quality (June 2026)', 'EMISSIONS', 'GHG Footprint (Scope 1+2)', 161.2, 'tCO2e', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Scope 1 (Direct Combustion)","value":42.8,"unit":"tCO2e"},{"label":"Scope 2 (Purchased Electricity)","value":118.4,"unit":"tCO2e"},{"label":"Scope 3 (Value Chain)","value":26.2,"unit":"tCO2e"},{"label":"Total GHG Footprint","value":187.4,"unit":"tCO2e"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793839695161-7l8ivx","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 3 — GHG Emissions & Air Quality","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:48:15.162Z"}]', 'EMISSIONS', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:18:09.742Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2tv14p002r7kggeesb24as', 'PU-mw2tv14b-PAAR', 'Pavagada Mega Solar Complex Expansion — Level 7 — Environmental Permits & Compliance (June 2026)', 'COMPLIANCE', 'Permits & Regulatory Approvals', 14, 'active', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Consent to Operate (CTO)","value":"Active & Verified","unit":""},{"label":"Consent to Establish (CTE)","value":"Active","unit":""},{"label":"EIA Clearance","value":"Compliant","unit":""},{"label":"Total Verified Permits","value":14,"unit":"permits"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793839739610-aokdnv","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 5 — Environmental Permits & Compliance","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:48:59.610Z"}]', 'COMPLIANCE', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:18:53.880Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2tti6u001n7kggeb1mo6nv', 'PU-mw2tti6k-U2Q5', 'Pavagada Mega Solar Complex Expansion — Level 1 — Energy Consumption (June 2026)', 'ENERGY', 'Total Energy Consumption', 87.72, 'GJ', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Grid Electricity","value":"14,200","unit":"kWh"},{"label":"Diesel (DG Sets)","value":"480","unit":"Liters"},{"label":"Rooftop Solar","value":"5,100","unit":"kWh"},{"label":"Total Energy (Normalized)","value":"87.72","unit":"GJ"}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793839666679-dwlyud","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 1 — Energy Consumption","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:47:46.679Z"}]', 'ENERGY', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:17:42.678Z', '2026-11-04T19:38:29.109Z'),
  ('cmw2tvclo002z7kggl6jvrph1', 'PU-mw2tvclg-MWGX', 'Pavagada Mega Solar Complex Expansion — Level 9 — Energy & Environmental Initiatives (June 2026)', 'CSR', 'Energy Conservation Initiatives', 3, 'programs', 'SUBMITTED', FALSE, 'FY 2025-26', 'Q1', '2026-06-30T18:29:59.000Z', '2026-11-04T19:38:29.109Z', NULL, 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt596uj00017k44uqelt2ry', NULL, '[{"label":"Solar Rooftop Addition","value":"5.1 MW Capacity","unit":""},{"label":"LED Retrofit Phase II","value":"18% Energy Savings","unit":""},{"label":"VFD Compressor Upgrades","value":"Active","unit":""}]', '["PVAN-Grid-Bill-Apr2026.csv","PVAN-Diesel-Register-Apr2026.csv","PVAN-Water-STP-Apr2026.csv"]', '[]', '[{"id":"h-1793839753861-03blpr","fromStatus":"DRAFT","toStatus":"SUBMITTED","actorId":"cmvt596uj00017k44uqelt2ry","actorName":"Rohit Kumar","actorRole":"PROJECT_USER","action":"SUBMIT","comment":"Submitted via Data Entry Workspace — Level 6 — Environmental Initiatives","reason":null,"oldValues":null,"newValues":null,"createdAt":"2026-11-05T00:49:13.861Z"}]', 'INITIATIVES', '[null]', 'cmvt6ag9q00087kxwvb2pkxhx', 100, 3, 1, 0, NULL, NULL, NULL, '[]', '2026-11-04T19:19:08.748Z', '2026-11-04T19:38:29.109Z');

-- Table "public"."SubmissionStatusHistory" (2 rows)
INSERT INTO "public"."SubmissionStatusHistory" ("id", "submissionId", "fromStatus", "toStatus", "actorId", "actorName", "actorRole", "action", "comment", "reason", "oldValues", "newValues", "createdAt") VALUES
  ('cmvt6cu8v00407kxw31av97cn', 'cmvt6ct7b003y7kxwaiyjbsp2', 'DRAFT', 'SUBMITTED', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Environment Data User', 'SUBMIT', 'April energy data submitted with evidence', NULL, NULL, NULL, '2026-05-03T04:30:00.000Z'),
  ('cmvt6cv6a00427kxwl7grg04o', 'cmvt6ct7b003y7kxwaiyjbsp2', 'SUBMITTED', 'APPROVED', 'cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'Environment Data User', 'APPROVE', 'Approved after BU review', NULL, NULL, NULL, '2026-05-06T05:30:00.000Z');

-- Table "public"."Subsidiary" (7 rows)
INSERT INTO "public"."Subsidiary" ("id", "code", "name", "sector", "region", "city", "status", "managerName", "adminName", "description", "createdAt", "updatedAt") VALUES
  ('cmvt57yuo00007kss94thg3ht', 'MEIL', 'Megha Engineering & Infrastructures Ltd (MEIL Core)', 'Core Infrastructure & Engineering', 'Pan India & Global', 'Hyderabad', 'ACTIVE', 'P. Rama Rao', 'Priya Deshmukh', 'Flagship EPC infrastructure, irrigation networks, hydrocarbons, and power transmission.', '2026-10-29T00:39:11.472Z', '2026-10-29T00:39:11.472Z'),
  ('cmvt5801900027kssuly4mmhh', 'DRILLMEC', 'Drillmec S.p.A.', 'Drilling Systems & Deep Automation', 'International', 'Piacenza, Italy', 'ACTIVE', 'Simone Trevisani', 'Mei Ling Tan', 'World leader in automated hydraulic drilling rigs, offshore packages and geothermal systems.', '2026-10-29T00:39:11.472Z', '2026-10-29T00:39:11.472Z'),
  ('cmvt5801g00037kssudyfd24t', 'MHYDRO', 'MEIL Hydro Power Limited', 'Hydro Power & Pumped Storage', 'Pan India', 'Hyderabad', 'ACTIVE', 'Anil Kapoor', 'Shalini Verma', 'Multi-stage pumped storage hydro projects, barrage schemes and green peaking capacity.', '2026-10-29T00:39:11.473Z', '2026-10-29T00:39:11.473Z'),
  ('cmvt5801900017kssdbm9g6sp', 'MSOLAR', 'MEIL Solar Energy Limited', 'Renewable & Clean Energy', 'Pan India', 'Hyderabad', 'ACTIVE', 'Rajesh Menon', 'Divya Iyer', 'Utility-scale solar parks, canal-top solar and floating solar arrays.', '2026-10-29T00:39:11.473Z', '2026-10-29T00:39:11.473Z'),
  ('cmvt5802b00047kssx9rm5o3a', 'MCGDH', 'Megha City Gas Distribution Holding', 'City Gas Distribution & Hydrocarbons', 'Pan India', 'Hyderabad', 'ACTIVE', 'Vikram Shetty', 'Kavita Nair', 'City Gas Distribution (CGD), CNG compression stations and piped natural gas networks.', '2026-10-29T00:39:11.472Z', '2026-10-29T00:39:11.472Z'),
  ('cmvt5802h00057kss5vcrhfln', 'PETREVEN', 'Petreven S.p.A.', 'Oilfield & Well Services', 'International', 'Cesena, Italy', 'ACTIVE', 'Roberto Rossi', 'Elena Rossi', 'Global oilfield operations, well completion and low-footprint eco-drilling services.', '2026-10-29T00:39:11.472Z', '2026-10-29T00:39:11.472Z'),
  ('cmvt5803c00067kss8eawwp01', 'OLECTRA', 'Olectra Greentech Limited', 'Electric Mobility & Green Technology', 'Pan India', 'Hyderabad', 'ACTIVE', 'K. V. Pradeep', 'Sunita Rao', 'Pioneer in electric bus manufacturing, EV powertrains and clean public transit.', '2026-10-29T00:39:11.472Z', '2026-10-29T00:39:11.472Z');

-- Table "public"."Task" (17 rows)
INSERT INTO "public"."Task" ("id", "ref", "title", "description", "category", "assigneeType", "assigneeLabel", "assigneeFilter", "subsidiaryId", "businessUnitId", "period", "startDate", "dueDate", "priority", "status", "requiresEvidence", "recipients", "acknowledged", "completed", "remindersSent", "reminderLog", "createdAt", "updatedAt") VALUES
  ('cmvt5893b00647kssr1dme84m', 'TSK-2526-003', 'FY2025-26 H1 HR & workforce data collection', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'WORKFORCE', 'ROLE', 'HR Users (group-wide)', '{}', NULL, NULL, 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-10-26T22:34:00.000Z', 'HIGH', 'OVERDUE', TRUE, 4, 3, 0, 2, '[{"at":"2026-10-26T03:51:00.000Z","channel":"In-app"},{"at":"2026-10-28T04:17:00.000Z","channel":"In-app"}]', '2026-10-29T00:39:24.743Z', '2026-10-29T00:39:24.743Z'),
  ('cmvt5893d00677kss559d56tg', 'TSK-2526-007', 'BRSR Core — leadership integrity disclosures', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'COMPLIANCE', 'ROLE', 'Compliance Users', '{}', NULL, NULL, 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-11-12T23:15:00.000Z', 'MEDIUM', 'UPCOMING', TRUE, 3, 0, 0, 0, '[]', '2026-10-29T00:39:24.745Z', '2026-10-29T00:39:24.745Z'),
  ('cmvt5893a00617kssqdz9v09u', 'TSK-2526-006', 'CSR impact report — community programs', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'CSR', 'USER', 'Lakshmi Prasad', '{}', 'cmvt5802b00047kssx9rm5o3a', NULL, 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-10-23T22:55:00.000Z', 'HIGH', 'OVERDUE', TRUE, 1, 1, 0, 2, '[{"at":"2026-10-26T03:51:00.000Z","channel":"In-app"},{"at":"2026-10-28T04:17:00.000Z","channel":"In-app"}]', '2026-10-29T00:39:24.742Z', '2026-10-29T00:39:24.742Z'),
  ('cmvt5893f00687kss41mizuv9', 'TSK-2526-008', 'Renewable energy certificate (REC) reconciliation', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'ENERGY', 'BU', 'Solar Parks BU — all eligible users', '{}', NULL, 'cmvt5829f000w7kss4s9oe6uq', 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-10-29T23:13:00.000Z', 'HIGH', 'ACTIVE', TRUE, 4, 4, 2, 1, '[]', '2026-10-29T00:39:24.747Z', '2026-10-29T00:39:24.747Z'),
  ('cmvt5893c00667kssmjlxspw1', 'TSK-2526-004', 'Quarterly water withdrawal reconciliation', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'WATER', 'SUBSIDIARY', 'MEIL Core — all users', '{}', 'cmvt57yuo00007kss94thg3ht', NULL, 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-11-06T23:57:00.000Z', 'MEDIUM', 'UPCOMING', TRUE, 8, 1, 0, 0, '[]', '2026-10-29T00:39:24.744Z', '2026-10-29T00:39:24.744Z'),
  ('cmvt5893c00657kss2522fkgc', 'TSK-2526-001', 'Submit Q2 FY26 environmental metrics for Irrigation BU', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'ENVIRONMENT', 'BU', 'Irrigation & Water — all eligible users', '{}', NULL, 'cmvt5810000087kssr4oure2y', 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-10-31T23:39:00.000Z', 'HIGH', 'ACTIVE', TRUE, 6, 4, 1, 1, '[]', '2026-10-29T00:39:24.744Z', '2026-10-29T00:39:24.744Z'),
  ('cmvt5893f00697kssqprde86o', 'TSK-2526-009', 'Zero emission fleet reporting — Olectra', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'ENVIRONMENT', 'SUBSIDIARY', 'Olectra Greentech Limited', '{}', 'cmvt5803c00067kss8eawwp01', NULL, 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-11-15T23:54:00.000Z', 'HIGH', 'UPCOMING', TRUE, 6, 2, 0, 0, '[]', '2026-10-29T00:39:24.747Z', '2026-10-29T00:39:24.747Z'),
  ('cmvt5893a00627ksszyshl7e7', 'TSK-2526-002', 'Upload Q2 safety incident logs across all 16 Business Units', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'SAFETY', 'ROLE', 'EHS / Safety Users (group-wide)', '{}', NULL, NULL, 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-11-03T23:18:00.000Z', 'CRITICAL', 'ACTIVE', TRUE, 7, 5, 0, 1, '[]', '2026-10-29T00:39:24.742Z', '2026-10-29T00:39:24.742Z'),
  ('cmvt5893b00637kssyzy800nv', 'TSK-2526-005', 'Update supplier ESG scores for Q2', 'Consolidated reporting instruction issued by Group ESG office. Provide supporting evidence with each data point.', 'PROCUREMENT', 'ROLE', 'Procurement Users', '{}', NULL, NULL, 'FY 2025-26', '2026-10-08T22:40:00.000Z', '2026-11-09T23:36:00.000Z', 'MEDIUM', 'UPCOMING', TRUE, 3, 1, 0, 0, '[]', '2026-10-29T00:39:24.743Z', '2026-10-29T00:39:24.743Z'),
  ('cmvt63i41000s7kj46o3dn8s7', 'TSK-BU-3002-001', 'Verify lab calibration for Marathwada Water Grid', '', 'WATER', 'USER', '', '{"businessUnitId":"cmvt582ba00107ksstpd3cm6s","role":"ENV_DATA_USER"}', 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'FY 2025-26', '2026-10-26T21:22:00.000Z', '2026-11-01T07:57:00.000Z', 'HIGH', 'ACTIVE', TRUE, 3, 0, 0, 0, '[]', '2026-10-29T01:03:42.769Z', '2026-10-29T01:03:42.769Z'),
  ('cmvt63je0000u7kj4uwnfrqd6', 'TSK-BU-3002-003', 'Submit Q2 BU reporting package to Subsidiary', '', 'COMPLIANCE', 'USER', '', '{"businessUnitId":"cmvt582ba00107ksstpd3cm6s","role":"BU_ADMIN"}', 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'FY 2025-26', '2026-10-13T21:15:00.000Z', '2026-10-28T06:41:00.000Z', 'CRITICAL', 'OVERDUE', FALSE, 1, 0, 0, 0, '[]', '2026-10-29T01:03:42.770Z', '2026-10-29T01:03:42.770Z'),
  ('cmvt63je0000t7kj4ulecrsgn', 'TSK-BU-3002-002', 'Coordinate leak detection survey — Vidarbha', '', 'WATER', 'USER', '', '{"businessUnitId":"cmvt582ba00107ksstpd3cm6s","role":"EHS_USER"}', 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'FY 2025-26', '2026-10-30T22:38:00.000Z', '2026-11-08T07:10:00.000Z', 'MEDIUM', 'UPCOMING', FALSE, 2, 0, 0, 0, '[]', '2026-10-29T01:03:42.770Z', '2026-10-29T01:03:42.770Z'),
  ('cmvzflfpe000xe9jwlqqm4ow9', 'CORR-PRJ-ZOJ-3053', 'Action Required: Data Correction for PROCUREMENT_USER', 'Automated verification test: Please upload calibration certificate for water flow meter.', 'PROCUREMENT_USER', 'USER', 'cmvt5869u004e7kss3ia23eko', '{}', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'FY 2025-26', '2026-11-02T10:16:13.053Z', '2026-11-05T10:16:13.053Z', 'HIGH', 'ASSIGNED', TRUE, 1, 0, 0, 0, '[]', '2026-11-02T10:16:13.059Z', '2026-11-02T10:16:13.059Z'),
  ('cmvzh93e3001ge9jwssnmg7mx', 'CORR-PRJ-ZOJ-6455', 'Action Required: Data Correction for PROCUREMENT_USER', 'Lab test report missing calibration stamp.', 'PROCUREMENT_USER', 'USER', 'cmvt5869u004e7kss3ia23eko', '{}', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'FY 2025-26', '2026-11-02T11:02:36.455Z', '2026-11-05T11:02:36.455Z', 'HIGH', 'ASSIGNED', TRUE, 1, 0, 0, 0, '[]', '2026-11-02T11:02:36.460Z', '2026-11-02T11:02:36.460Z'),
  ('cmvzha6r5001qe9jwc2x4xfen', 'TSK-PRJ-ZOJ-015', 'Submit Q4 Scope 1 Genset Fuel Vouchers', 'Upload all verified log sheets and fuel vendor GST invoices.', 'ENV_DATA_USER', 'USER', 'Project Site Admin', '{}', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'FY 2025-26', '2026-11-02T11:03:27.472Z', '2026-03-27T18:30:00.000Z', 'MEDIUM', 'PENDING', TRUE, 1, 0, 0, 0, '[]', '2026-11-02T11:03:27.474Z', '2026-11-02T11:03:27.474Z'),
  ('cmw2h29xb00b4e9wor0nrsl8q', 'CORR-PRJ-RIG-HH300-6858', 'Action Required: Data Correction for ENV_DATA_USER', 'gogo', 'ENV_DATA_USER', 'USER', 'cmvt596uj00017k44uqelt2ry', '{}', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'FY 2025-26', '2026-11-04T13:20:36.858Z', '2026-11-07T13:20:36.858Z', 'HIGH', 'ASSIGNED', TRUE, 1, 0, 0, 0, '[]', '2026-11-04T13:20:36.860Z', '2026-11-04T13:20:36.860Z'),
  ('cmw2hw1yj00bwe9wo2osry2y9', 'CORR-PRJ-RIG-HH300-6217', 'Action Required: Correction for HH-300 Automated Hydraulic Rigs Line — Level 1 — Energy Consumption (June 2026)', 'Project Admin audit: Meter delta discrepancies detected on Diesel DG set logs. Please attach audited meter calibration report.', 'CORRECTION', 'USER', 'Responsible Site Contributor', 'cmvt596uj00017k44uqelt2ry', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'FY 2025-26', '2026-11-04T13:43:42.024Z', '2026-11-07T13:43:42.024Z', 'HIGH', 'ASSIGNED', TRUE, 1, 0, 0, 0, '[]', '2026-11-04T13:43:46.219Z', '2026-11-04T13:43:46.219Z');

-- Table "public"."TravelRecord" (0 rows)

-- Table "public"."UnitMaster" (9 rows)
INSERT INTO "public"."UnitMaster" ("id", "code", "name", "category", "baseUnit", "createdAt") VALUES
  ('cmvt6ah5r00097kxw1ymmijsy', 'KWH', 'Kilowatt-hour', 'ENERGY', 'KWH', '2026-10-29T01:09:08.127Z'),
  ('cmvt6aiqa000a7kxw47pmrujb', 'MWH', 'Megawatt-hour', 'ENERGY', 'KWH', '2026-10-29T01:09:10.162Z'),
  ('cmvt6akb0000b7kxwonyn4v3a', 'GJ', 'Gigajoule', 'ENERGY', 'GJ', '2026-10-29T01:09:12.204Z'),
  ('cmvt6alw1000c7kxw5pgtajuo', 'L', 'Litre', 'VOLUME', 'L', '2026-10-29T01:09:14.257Z'),
  ('cmvt6anfo000d7kxwbj9se739', 'KL', 'Kilolitre', 'VOLUME', 'L', '2026-10-29T01:09:16.260Z'),
  ('cmvt6ap28000e7kxww1hyigku', 'M3', 'Cubic metre', 'VOLUME', 'L', '2026-10-29T01:09:18.368Z'),
  ('cmvt6aqn3000f7kxwqsd0tzxs', 'KG', 'Kilogram', 'MASS', 'KG', '2026-10-29T01:09:20.416Z'),
  ('cmvt6asgp000g7kxwccf8b82w', 'TON', 'Metric tonne', 'MASS', 'KG', '2026-10-29T01:09:22.527Z'),
  ('cmvt6au3b000h7kxwzxuymz2f', 'TCO2E', 'tCO2e', 'EMISSION', 'TCO2E', '2026-10-29T01:09:24.887Z');

-- Table "public"."User" (51 rows)
INSERT INTO "public"."User" ("id", "name", "email", "employeeId", "passwordHash", "role", "status", "subsidiaryId", "businessUnitId", "projectId", "phone", "title", "joinedAt", "lastActiveAt", "lastLoginAt", "createdAt", "updatedAt") VALUES
  ('cmvt585d9003q7ksscxopka50', 'Elena Rossi', 'elena.rossi@petreven.com', 'SUB-5002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_ADMIN', 'ACTIVE', 'cmvt5802h00057kss5vcrhfln', NULL, NULL, '', 'Subsidiary ESG Admin · Petreven', '2026-10-29T00:39:19.913Z', '2026-10-27T11:38:42.200Z', NULL, '2026-10-29T00:39:19.913Z', '2026-10-29T02:23:57.482Z'),
  ('cmvt5869500407kssvztvhnvw', 'Gopal Rao', 'gopal.rao@meil.in', 'BU-1002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_ADMIN', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', NULL, '', 'BU Admin · Irrigation & Water', '2026-10-29T00:39:19.915Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.915Z', '2026-10-29T02:24:18.244Z'),
  ('cmvt585cy00377kssqcxj5amy', 'Roberto Rossi', 'roberto.rossi@petreven.com', 'SUB-5001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_MANAGER', 'ACTIVE', 'cmvt5802h00057kss5vcrhfln', NULL, NULL, '', 'Managing Director · Petreven S.p.A.', '2026-10-29T00:39:19.903Z', '2026-10-29T00:21:17.112Z', NULL, '2026-10-29T00:39:19.903Z', '2026-10-29T02:25:13.313Z'),
  ('cmvt6a99d00017kxwqvom7hkq', 'Sameer Khan', 'sameer@meil-esg.in', 'EMP-0042', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'ESG_ANALYST', 'ACTIVE', NULL, NULL, 'cmvt5836o001f7ksssq1ngm1s', '+91 98480 11028', 'ESG Analyst — Group Analytics', '2026-10-29T01:08:57.888Z', NULL, NULL, '2026-10-29T01:08:57.888Z', '2026-10-29T02:25:15.722Z'),
  ('cmvt585cx00357ksszrc0ktcc', 'Simone Trevisani', 'simone.trevisani@drillmec.com', 'SUB-4001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_MANAGER', 'ACTIVE', 'cmvt5801900027kssuly4mmhh', NULL, NULL, '', 'CEO · Drillmec S.p.A.', '2026-10-29T00:39:19.903Z', '2026-10-27T15:43:17.112Z', NULL, '2026-10-29T00:39:19.903Z', '2026-10-29T02:25:19.444Z'),
  ('cmvt585d3003i7kssehnd6a4g', 'Harish Chandra', 'harish.chandra@meil.in', 'BU-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', NULL, '', 'BU Head · Irrigation & Water', '2026-10-29T00:39:19.911Z', '2026-10-29T00:41:17.112Z', NULL, '2026-10-29T00:39:19.911Z', '2026-10-29T02:24:25.322Z'),
  ('cmvt585d8003n7kssg4mcga3d', 'Kavita Nair', 'kavita.nair@meghagas.com', 'SUB-3002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_ADMIN', 'ACTIVE', 'cmvt5802b00047kssx9rm5o3a', NULL, NULL, '', 'Subsidiary ESG Admin · Megha City Gas', '2026-10-29T00:39:19.909Z', '2026-10-28T01:38:42.200Z', NULL, '2026-10-29T00:39:19.909Z', '2026-10-29T02:24:34.282Z'),
  ('cmvt58694003y7kss1v6vvolk', 'Kiran Reddy', 'kiran.reddy@olectra.com', 'EMP-0019', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_ADMIN', 'ACTIVE', 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', NULL, '', 'BU Admin · EV Powertrain', '2026-10-29T00:39:19.916Z', '2026-10-29T00:37:17.112Z', NULL, '2026-10-29T00:39:19.916Z', '2026-10-29T02:24:35.407Z'),
  ('cmvt585cw00337kssddyiz58t', 'K. V. Pradeep', 'kv.pradeep@olectra.com', 'SUB-2001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_MANAGER', 'ACTIVE', 'cmvt5803c00067kss8eawwp01', NULL, NULL, '', 'Managing Director · Olectra Greentech', '2026-10-29T00:39:19.903Z', '2026-10-28T15:38:42.200Z', NULL, '2026-10-29T00:39:19.903Z', '2026-10-29T02:24:36.558Z'),
  ('cmvt586a2004g7kss0lo08i6q', 'Lakshmi Prasad', 'lakshmi.prasad@meil.in', 'CSR-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'CSR_USER', 'ACTIVE', 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', 'cmvt5842u002e7ksst5ue6prl', '', 'CSR Program Lead', '2026-10-29T00:39:19.918Z', '2026-10-27T18:38:42.200Z', NULL, '2026-10-29T00:39:19.918Z', '2026-10-29T02:24:38.807Z'),
  ('cmvt585d9003p7kss21qooaxb', 'Manoj Sharma', 'manoj.sharma@meil.in', 'BU-2001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', NULL, '', 'BU Head · Heavy Civil & Tunnels', '2026-10-29T00:39:19.913Z', '2026-10-29T00:33:17.112Z', NULL, '2026-10-29T00:39:19.913Z', '2026-10-29T02:24:40.013Z'),
  ('cmvt585d2003e7kss5ki8ktww', 'Mei Ling Tan', 'meiling.tan@drillmec.com', 'SUB-4002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_ADMIN', 'ACTIVE', 'cmvt5801900027kssuly4mmhh', NULL, NULL, '', 'Subsidiary ESG Admin · Drillmec', '2026-10-29T00:39:19.910Z', '2026-10-27T18:38:42.200Z', NULL, '2026-10-29T00:39:19.910Z', '2026-10-29T02:24:41.157Z'),
  ('cmvt5867h003u7kssnucokg17', 'Paolo Martini', 'paolo.martini@drillmec.com', 'EMP-0029', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, '', 'BU Head · Rig Automation', '2026-10-29T00:39:19.915Z', '2026-10-29T00:29:17.112Z', NULL, '2026-10-29T00:39:19.915Z', '2026-10-29T02:24:46.997Z'),
  ('cmvt5869600437kssumtalrxt', 'Rahul Desai', 'rahul.desai@meghagas.com', 'EMP-0034', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_ADMIN', 'ACTIVE', 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', NULL, '', 'BU Admin · City Gas Distribution', '2026-10-29T00:39:19.916Z', '2026-10-29T00:25:17.112Z', NULL, '2026-10-29T00:39:19.916Z', '2026-10-29T02:24:53.703Z'),
  ('cmvt5869u004e7kss3ia23eko', 'Ravi Teja', 'ravi.teja@meil.in', 'PRO-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'PROCUREMENT_USER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n001a7ksspy772hsr', '', 'Procurement Analyst · Thane-Borivali', '2026-10-29T00:39:19.918Z', '2026-10-28T01:38:42.200Z', NULL, '2026-10-29T00:39:19.918Z', '2026-10-29T02:25:10.898Z'),
  ('cmvt5871q004s7kss4jtams2u', 'Shalini Verma', 'shalini.verma@meilhydro.com', 'SUB-7002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_ADMIN', 'ACTIVE', 'cmvt5801g00037kssudyfd24t', NULL, NULL, '', 'Subsidiary ESG Admin · MEIL Hydro', '2026-10-29T00:39:19.919Z', '2026-10-27T10:43:17.112Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:25:18.237Z'),
  ('cmvt5869s004c7kss7vg6a5sq', 'Sneha Kulkarni', 'sneha.kulkarni@meil.in', 'EHS-1002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'EHS_USER', 'ACTIVE', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', 'cmvt5843v002q7kss3etabcc9', '', 'EHS Safety Officer · Pinnapuram Hydro', '2026-10-29T00:39:19.918Z', '2026-10-28T15:38:42.200Z', NULL, '2026-10-29T00:39:19.918Z', '2026-10-29T02:25:20.599Z'),
  ('cmvt59e8r00057k44o8e7e684', 'Sunita Rao', 'sunita@meil-esg.in', 'PU-HR-016', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'HR_USER', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836n00167kss0csnb7il', '+91 98480 11024', 'HR Data Coordinator', '2026-10-29T00:40:18.075Z', NULL, NULL, '2026-10-29T00:40:18.075Z', '2026-10-29T02:25:22.965Z'),
  ('cmvt586at004m7kssfdznrms4', 'Tarun Bhatia', 'tarun.bhatia@meil.in', 'EMP-0050', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'ENV_DATA_USER', 'ACTIVE', 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', 'cmvt5842v002i7kssnqny18q2', '', 'Environment Data Officer · Canal Solar', '2026-10-29T00:39:19.919Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:25:25.370Z'),
  ('cmvt5869900467ksshlt6lz2z', 'Project Site Admin', 'admin@site.meil.in', 'PRJ-ADMIN', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'PROJECT_ADMIN', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n00167kss0csnb7il', '', 'Project Site Administrator · Zojila', '2026-10-29T00:39:19.916Z', '2026-10-29T00:21:42.200Z', '2026-11-02T10:23:07.471Z', '2026-10-29T00:39:19.916Z', '2026-11-02T10:23:07.473Z'),
  ('cmvt596uj00017k44uqelt2ry', 'Rohit Kumar', 'rohit@meil-esg.in', 'PU-ENV-014', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'ENV_DATA_USER', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5842u002c7kssl8jciq2c', '+91 98480 11021', 'Environment Data Officer', '2026-10-29T00:40:08.491Z', '2026-11-04T19:39:49.087Z', '2026-11-04T19:39:49.087Z', '2026-10-29T00:40:08.491Z', '2026-11-04T19:39:49.109Z'),
  ('cmvt585cx00347ksss5by9nap', 'Anil Kapoor', 'anil.kapoor@meilhydro.com', 'SUB-7001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_MANAGER', 'ACTIVE', 'cmvt5801g00037kssudyfd24t', NULL, NULL, '', 'MD · MEIL Hydro Power', '2026-10-29T00:39:19.904Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.904Z', '2026-10-29T02:23:45.242Z'),
  ('cmvt5869800457kss9qxwdkac', 'Anita Joshi', 'anita.joshi@olectra.com', 'BU-4002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_ADMIN', 'ACTIVE', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', NULL, '', 'BU Admin · Electric Bus Plant', '2026-10-29T00:39:19.917Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.917Z', '2026-10-29T02:23:46.398Z'),
  ('cmvt5869h004a7kss2vtjxjbn', 'Aparna Das', 'aparna.das@meil.in', 'HR-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'HR_USER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n00167kss0csnb7il', '', 'HR Data Coordinator · Zojila', '2026-10-29T00:39:19.918Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.918Z', '2026-10-29T02:23:47.676Z'),
  ('cmvt585db003s7kss15cmt9lf', 'Arvind Mehta', 'arvind.mehta@meilsolar.com', 'EMP-0006', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', NULL, '', 'BU Head · Utility Solar Parks', '2026-10-29T00:39:19.915Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.915Z', '2026-10-29T02:23:49.837Z'),
  ('cmvt5872t004u7kssxxuu9alr', 'B. Shanker', 'b.shanker@olectra.com', 'BU-4001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', NULL, '', 'BU Head · Electric Bus Plant', '2026-10-29T00:39:19.919Z', '2026-10-27T05:43:17.112Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:23:50.919Z'),
  ('cmvt58695003z7kssgsa8aoil', 'Carlos Mendez', 'carlos.mendez@petreven.com', 'EMP-0008', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', NULL, '', 'BU Head · Global Clean Oilfield', '2026-10-29T00:39:19.916Z', '2026-10-27T11:38:42.200Z', NULL, '2026-10-29T00:39:19.916Z', '2026-10-29T02:23:52.003Z'),
  ('cmvt586ar004i7ksswptmforv', 'Farhan Ali', 'farhan.ali@meil.in', 'CMP-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'COMPLIANCE_USER', 'ACTIVE', 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', 'cmvt5842s00227kssdkxf07uj', '', 'Compliance Officer', '2026-10-29T00:39:19.919Z', '2026-10-28T15:38:42.200Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:24:08.820Z'),
  ('cmvt598j000037k44af55q323', 'Rahul Verma', 'finance@meil-esg.in', 'PU-FIN-015', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'FIN_RESOURCE_USER', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836o001f7ksssq1ngm1s', '+91 98480 11022', 'Finance & Resource Analyst', '2026-10-29T00:40:10.667Z', NULL, NULL, '2026-10-29T00:40:10.667Z', '2026-10-29T02:24:13.607Z'),
  ('cmvt59gde00077k44q6tymhwf', 'K. Venkat', 'kvenkat@meil-esg.in', 'PU-EHS-017', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'EHS_USER', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836o001f7ksssq1ngm1s', '+91 98480 11023', 'EHS Safety Officer', '2026-10-29T00:40:20.834Z', NULL, NULL, '2026-10-29T00:40:20.834Z', '2026-10-29T02:24:37.679Z'),
  ('cmvt586as004k7kssv4ghlr18', 'Nikhil Chandra', 'nikhil.chandra@drillmec.com', 'EMP-0027', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'EHS_USER', 'SUSPENDED', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', '', 'EHS Safety Officer · Drillmec', '2026-10-29T00:39:19.919Z', '2026-10-07T21:27:00.000Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:24:44.762Z'),
  ('cmvt586aw004o7kssllwdochk', 'Old Contractor', 'old.contractor@meil.in', 'EMP-0028', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'FIN_RESOURCE_USER', 'INACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n00167kss0csnb7il', '', 'Contract Finance', '2026-10-29T00:39:19.919Z', '2026-07-30T21:30:00.000Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:24:45.846Z'),
  ('cmvt585da003r7kss6inufrqb', 'Prasad Patil', 'prasad.patil@meghagas.com', 'EMP-0030', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', NULL, '', 'BU Head · City Gas Networks', '2026-10-29T00:39:19.913Z', '2026-10-28T01:38:42.200Z', NULL, '2026-10-29T00:39:19.913Z', '2026-10-29T02:24:48.079Z'),
  ('cmvt585cy00387kssujsrm7sk', 'Priya Deshmukh', 'priya.deshmukh@meil.in', 'SUB-1002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_ADMIN', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', NULL, NULL, '', 'Subsidiary ESG Admin · MEIL Core', '2026-10-29T00:39:19.905Z', '2026-10-28T15:38:42.200Z', NULL, '2026-10-29T00:39:19.905Z', '2026-10-29T02:24:49.239Z'),
  ('cmvt585cy003a7kssn988vzel', 'Rajesh Menon', 'rajesh.menon@meilsolar.com', 'SUB-6001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_MANAGER', 'ACTIVE', 'cmvt5801900017kssdbm9g6sp', NULL, NULL, '', 'MD · MEIL Solar Energy', '2026-10-29T00:39:19.904Z', '2026-10-28T15:38:42.200Z', NULL, '2026-10-29T00:39:19.904Z', '2026-10-29T02:24:59.105Z'),
  ('cmvt585d1003c7kssnx520ryb', 'P. Rama Rao', 'rama.rao@meil.in', 'SUB-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_MANAGER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', NULL, NULL, '', 'Managing Director · MEIL Core', '2026-10-29T00:39:19.902Z', '2026-10-29T00:31:42.200Z', NULL, '2026-10-29T00:39:19.902Z', '2026-10-29T02:25:07.501Z'),
  ('cmvt585d3003g7kssk4aqkga9', 'Sunita Rao', 'sunita.rao@olectra.com', 'SUB-2002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_ADMIN', 'ACTIVE', 'cmvt5803c00067kss8eawwp01', NULL, NULL, '', 'Subsidiary ESG Admin · Olectra', '2026-10-29T00:39:19.910Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.910Z', '2026-10-29T02:25:21.840Z'),
  ('cmvt58734004w7kssznfgqz9r', 'Suresh Babu', 'suresh.babu@meil.in', 'BU-3001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', NULL, '', 'BU Head · Hydrocarbons & Pipelines', '2026-10-29T00:39:19.919Z', '2026-10-27T00:43:17.112Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:25:24.150Z'),
  ('cmvt585cv002y7kssv56qxf63', 'Vikram Shetty', 'vikram.shetty@meghagas.com', 'SUB-3001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_MANAGER', 'ACTIVE', 'cmvt5802b00047kssx9rm5o3a', NULL, NULL, '', 'MD · Megha City Gas', '2026-10-29T00:39:19.902Z', '2026-10-28T08:38:42.200Z', NULL, '2026-10-29T00:39:19.902Z', '2026-10-29T02:25:26.518Z'),
  ('cmvt59nan000f7k44ov5pssam', 'Er. K. Venkataramana', 'projectadmin@meil-esg.in', 'ADM-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'PROJECT_ADMIN', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836p001t7kssxjh733ng', '', 'Project Admin & Site Director', '2026-10-29T00:40:29.806Z', '2026-11-04T19:38:51.753Z', '2026-11-04T19:38:51.753Z', '2026-10-29T00:40:29.806Z', '2026-11-04T19:38:51.764Z'),
  ('cmvt585d1003b7kssa9gqdy4a', 'Arun Bhaskar', 'arun.bhaskar@meil.in', 'GRP-0001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'GROUP_ADMIN', 'ACTIVE', NULL, NULL, NULL, '', 'Group ESG Administrator', '2026-10-29T00:39:19.901Z', '2026-10-29T00:36:42.200Z', '2026-11-02T08:12:58.429Z', '2026-10-29T00:39:19.901Z', '2026-11-02T08:12:58.431Z'),
  ('cmvt5873m00507ksse7b4ip4x', 'R. K. Sharma', 'rk.sharma@meilhydro.com', 'EMP-0039', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'BU_MANAGER', 'ACTIVE', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', NULL, '', 'BU Head · Pumped Storage Hydro', '2026-10-29T00:39:19.919Z', '2026-10-26T19:43:17.112Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:25:12.096Z'),
  ('cmvt5874900567ksssoj7p3zh', 'Mohit Jain', 'mohit.jain@meil.in', 'EHS-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'EHS_USER', 'ACTIVE', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', 'cmvt583co001y7kssv4sfemdb', '', 'EHS Safety Officer · Dindi Gigafactory', '2026-10-29T00:39:19.920Z', '2026-10-26T14:43:17.112Z', NULL, '2026-10-29T00:39:19.920Z', '2026-10-29T02:24:42.305Z'),
  ('cmvt5873l004z7kssug3pkwi2', 'New Joiner — ESG', 'new.joiner@meil.in', 'EMP-0026', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'HR_USER', 'INVITED', 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', '', 'HR Data Coordinator', '2026-10-29T00:39:19.919Z', NULL, NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:24:43.401Z'),
  ('cmvt5874800537ksse48vrxdf', 'Ramesh Iyer', 'ramesh.iyer@meil.in', 'ENV-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'ENV_DATA_USER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', 'cmvt5836n00157kssab54g3lw', '', 'Environment Data Officer', '2026-10-29T00:39:19.919Z', '2026-10-26T09:43:17.112Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:25:09.679Z'),
  ('cmvt5874800557kss8e044xns', 'Santosh Rao', 'santosh.rao@meil.in', 'FIN-1001', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'FIN_RESOURCE_USER', 'ACTIVE', 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', '', 'Finance & Resource Analyst', '2026-10-29T00:39:19.920Z', '2026-10-26T04:43:17.112Z', NULL, '2026-10-29T00:39:19.920Z', '2026-10-29T02:25:16.860Z'),
  ('cmvt5869b00487kssxj9r8w83', 'Deepa Krishnan', 'deepa.krishnan@meil.in', 'ENV-1002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'ENV_DATA_USER', 'ACTIVE', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002b7kssxf18hcgj', '', 'Environment Data Officer · Charanka Solar', '2026-10-29T00:39:19.917Z', '2026-10-28T15:38:42.200Z', NULL, '2026-10-29T00:39:19.917Z', '2026-10-29T02:23:53.032Z'),
  ('cmvt59ljw000d7k44foo97dci', 'Deepika Joshi', 'deepika@meil-esg.in', 'PU-CMP-020', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'COMPLIANCE_USER', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836n00187kssqlx68664', '+91 98480 11027', 'Compliance Officer', '2026-10-29T00:40:27.547Z', NULL, NULL, '2026-10-29T00:40:27.547Z', '2026-10-29T02:23:54.122Z'),
  ('cmvt586y5004q7ksshajzpgb0', 'Divya Iyer', 'divya.iyer@meilsolar.com', 'SUB-6002', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'SUBSIDIARY_ADMIN', 'ACTIVE', 'cmvt5801900017kssdbm9g6sp', NULL, NULL, '', 'Subsidiary ESG Admin · MEIL Solar', '2026-10-29T00:39:19.919Z', '2026-10-28T15:38:42.200Z', NULL, '2026-10-29T00:39:19.919Z', '2026-10-29T02:23:55.198Z'),
  ('cmvt59juh000b7k44ufyl80fu', 'Imran Sheikh', 'imran@meil-esg.in', 'PU-CSR-019', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'CSR_USER', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836n00157kssab54g3lw', '+91 98480 11026', 'CSR Program Lead', '2026-10-29T00:40:25.337Z', NULL, NULL, '2026-10-29T00:40:25.337Z', '2026-10-29T02:24:32.746Z');
INSERT INTO "public"."User" ("id", "name", "email", "employeeId", "passwordHash", "role", "status", "subsidiaryId", "businessUnitId", "projectId", "phone", "title", "joinedAt", "lastActiveAt", "lastLoginAt", "createdAt", "updatedAt") VALUES
  ('cmvt59i3800097k44thfqwabf', 'Priya Nair', 'priya@meil-esg.in', 'PU-PRC-018', 'scrypt$16384$8$1$yVkv817z5Wt0c02008GGQg==$AM79TpD2yvcmc24IIO3g/Ej5VvX5hCRsgYUujbmINhcTz6dIxbLGr1yP0UKlpQDOJBtU4KUW8GPiDCI9KAINpw==', 'PROCUREMENT_USER', 'ACTIVE', NULL, 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836n001a7ksspy772hsr', '+91 98480 11025', 'Procurement Analyst', '2026-10-29T00:40:23.058Z', NULL, NULL, '2026-10-29T00:40:23.058Z', '2026-10-29T02:24:51.237Z');

-- Table "public"."ValidationIssue" (42 rows)
INSERT INTO "public"."ValidationIssue" ("id", "ref", "severity", "rule", "description", "subsidiaryId", "businessUnitId", "projectId", "submissionId", "submissionRef", "period", "responsibleName", "status", "ownerName", "resolveNote", "detectedAt", "resolvedAt", "createdAt", "updatedAt") VALUES
  ('cmvt5f9x500127kvobo5znpn0', 'VLD-0001', 'HIGH', 'MISSING_EVIDENCE', 'Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', 'cmvt5880b005w7kssie1zhb6u', 'SUB-2526-013', 'FY 2025-26', 'Paolo Martini', 'OPEN', '', '', '2026-10-25T22:09:00.000Z', NULL, '2026-10-29T00:44:52.409Z', '2026-10-29T00:44:52.409Z'),
  ('cmvt5fatt00137kvo1vw27ovr', 'VLD-0002', 'CRITICAL', 'MISSING_SUBMISSION', 'No waste disposal submission received for the current quarter — deadline within 7 days.', 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', NULL, NULL, '', 'FY 2025-26', 'Luca Bianchi', 'OPEN', '', '', '2026-10-24T22:52:00.000Z', NULL, '2026-10-29T00:44:53.585Z', '2026-10-29T00:44:53.585Z'),
  ('cmvt5fbx400147kvokc1sbvli', 'VLD-0003', 'MEDIUM', 'UNIT_MISMATCH', 'Diesel consumption reported in litres while the disclosure requires kilolitres.', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, NULL, '', 'FY 2025-26', 'Paolo Martini', 'OPEN', '', '', '2026-10-23T22:35:00.000Z', NULL, '2026-10-29T00:44:54.769Z', '2026-10-29T00:44:54.769Z'),
  ('cmvt5fcvp00157kvosguzx9eh', 'VLD-0004', 'LOW', 'PERIOD_MISMATCH', 'Submission tagged Q1 but measurement log covers April–June (Q2 window).', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', NULL, NULL, '', 'FY 2025-26', 'Paolo Martini', 'ASSIGNED', 'Mei Ling Tan', '', '2026-10-22T22:18:00.000Z', NULL, '2026-10-29T00:44:56.246Z', '2026-10-29T00:44:56.246Z'),
  ('cmvt5fds500167kvoavyoewx9', 'VLD-0005', 'MEDIUM', 'DUPLICATE', 'Two water withdrawal submissions reference the same meter log for June.', 'cmvt5801900027kssuly4mmhh', 'cmvt5828s000s7kss8j43ho6y', 'cmvt5836q001w7kssm1wxdsd9', NULL, '', 'FY 2025-26', 'Paolo Martini', 'OPEN', '', '', '2026-10-21T22:01:00.000Z', NULL, '2026-10-29T00:44:57.413Z', '2026-10-29T00:44:57.413Z'),
  ('cmvt5feqr00177kvogss5e2pl', 'VLD-0006', 'HIGH', 'UNAPPROVED_SOURCE', 'Draft procurement entry feeds the green-spend ratio — source not yet approved.', 'cmvt5801900027kssuly4mmhh', 'cmvt5827d000m7ksso2iggunp', NULL, NULL, '', 'FY 2025-26', 'Luca Bianchi', 'OPEN', '', '', '2026-10-20T22:44:00.000Z', NULL, '2026-10-29T00:44:58.659Z', '2026-10-29T00:44:58.659Z'),
  ('cmvt5ffn500187kvofm4e9iry', 'VLD-0007', 'HIGH', 'MISSING_EVIDENCE', 'Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.', 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', 'cmvt5842s00227kssdkxf07uj', NULL, '', 'FY 2025-26', 'Amit Trivedi', 'OPEN', '', '', '2026-10-19T22:27:00.000Z', NULL, '2026-10-29T00:44:59.826Z', '2026-10-29T00:44:59.826Z'),
  ('cmvt5fgpc00197kvot8y77ym4', 'VLD-0008', 'CRITICAL', 'MISSING_SUBMISSION', 'No waste disposal submission received for the current quarter — deadline within 7 days.', 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', NULL, NULL, '', 'FY 2025-26', 'Prasad Patil', 'ASSIGNED', 'Kavita Nair', '', '2026-10-27T22:43:00.000Z', NULL, '2026-10-29T00:45:01.200Z', '2026-10-29T00:45:01.200Z'),
  ('cmvt5fhnp001a7kvouu0zynxk', 'VLD-0009', 'MEDIUM', 'UNIT_MISMATCH', 'Diesel consumption reported in litres while the disclosure requires kilolitres.', 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', NULL, NULL, '', 'FY 2025-26', 'Amit Trivedi', 'OPEN', '', '', '2026-10-26T22:26:00.000Z', NULL, '2026-10-29T00:45:02.437Z', '2026-10-29T00:45:02.437Z'),
  ('cmvt5fikx001b7kvozj07ohz3', 'VLD-0010', 'LOW', 'PERIOD_MISMATCH', 'Submission tagged Q1 but measurement log covers April–June (Q2 window).', 'cmvt5802b00047kssx9rm5o3a', 'cmvt582a8000y7kssxl4cy4cw', NULL, NULL, '', 'FY 2025-26', 'Rajesh Patel', 'OPEN', '', '', '2026-10-25T22:09:00.000Z', NULL, '2026-10-29T00:45:03.633Z', '2026-10-29T00:45:03.633Z'),
  ('cmvt5fjim001c7kvo6uz3x862', 'VLD-0011', 'MEDIUM', 'DUPLICATE', 'Two water withdrawal submissions reference the same meter log for June.', 'cmvt5802b00047kssx9rm5o3a', 'cmvt582bd00127kssruy3ckw5', 'cmvt5842s00227kssdkxf07uj', NULL, '', 'FY 2025-26', 'Amit Trivedi', 'OPEN', '', '', '2026-10-24T22:52:00.000Z', NULL, '2026-10-29T00:45:04.846Z', '2026-10-29T00:45:04.846Z'),
  ('cmvt5fkfy001d7kvoyffn3nbj', 'VLD-0012', 'HIGH', 'UNAPPROVED_SOURCE', 'Draft procurement entry feeds the green-spend ratio — source not yet approved.', 'cmvt5802b00047kssx9rm5o3a', 'cmvt58104000j7kssbn61rt7t', NULL, NULL, '', 'FY 2025-26', 'Prasad Patil', 'ASSIGNED', 'Kavita Nair', '', '2026-10-23T22:35:00.000Z', NULL, '2026-10-29T00:45:06.046Z', '2026-10-29T00:45:06.046Z'),
  ('cmvt5fld4001e7kvohw6z7wwu', 'VLD-0013', 'HIGH', 'MISSING_EVIDENCE', 'Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n001a7ksspy772hsr', 'cmvt58801005p7kss9z7gjjny', 'SUB-2526-001', 'FY 2025-26', 'Manoj Sharma', 'OPEN', '', '', '2026-10-22T22:18:00.000Z', NULL, '2026-10-29T00:45:07.240Z', '2026-10-29T00:45:07.240Z'),
  ('cmvt5fn9c001g7kvootn5cl10', 'VLD-0015', 'MEDIUM', 'UNIT_MISMATCH', 'Diesel consumption reported in litres while the disclosure requires kilolitres.', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', NULL, 'cmvt58806005u7ksssve227aj', 'SUB-2526-003', 'FY 2025-26', 'Manoj Sharma', 'OPEN', '', '', '2026-10-20T22:44:00.000Z', NULL, '2026-10-29T00:45:09.696Z', '2026-10-29T00:45:09.696Z'),
  ('cmvt5focz001h7kvop0y3dzzo', 'VLD-0016', 'LOW', 'PERIOD_MISMATCH', 'Submission tagged Q1 but measurement log covers April–June (Q2 window).', 'cmvt57yuo00007kss94thg3ht', 'cmvt5810000087kssr4oure2y', NULL, NULL, '', 'FY 2025-26', 'Harish Chandra', 'ASSIGNED', 'Priya Deshmukh', '', '2026-10-19T22:27:00.000Z', NULL, '2026-10-29T00:45:10.899Z', '2026-10-29T00:45:10.899Z'),
  ('cmvt5fp9h001i7kvoa4pho5zu', 'VLD-0017', 'MEDIUM', 'DUPLICATE', 'Two water withdrawal submissions reference the same meter log for June.', 'cmvt57yuo00007kss94thg3ht', 'cmvt58102000c7kssg4jtvr2x', 'cmvt5836n001a7ksspy772hsr', 'cmvt58801005n7kssqgm62y4r', 'SUB-2526-005', 'FY 2025-26', 'Manoj Sharma', 'OPEN', '', '', '2026-10-27T22:43:00.000Z', NULL, '2026-10-29T00:45:12.293Z', '2026-10-29T00:45:12.293Z'),
  ('cmvt5fr2v001k7kvoadhfphdk', 'VLD-0019', 'HIGH', 'MISSING_EVIDENCE', 'Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', 'cmvt5843v002o7kssqjomr1hq', NULL, '', 'FY 2025-26', 'R. K. Sharma', 'OPEN', '', '', '2026-10-25T22:09:00.000Z', NULL, '2026-10-29T00:45:14.647Z', '2026-10-29T00:45:14.647Z'),
  ('cmvt5fs1v001l7kvosg7s9hir', 'VLD-0020', 'CRITICAL', 'MISSING_SUBMISSION', 'No waste disposal submission received for the current quarter — deadline within 7 days.', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', NULL, NULL, '', 'FY 2025-26', 'R. K. Sharma', 'ASSIGNED', 'Shalini Verma', '', '2026-10-24T22:52:00.000Z', NULL, '2026-10-29T00:45:15.906Z', '2026-10-29T00:45:15.906Z'),
  ('cmvt5fszs001m7kvo9b96l1zl', 'VLD-0021', 'MEDIUM', 'UNIT_MISMATCH', 'Diesel consumption reported in litres while the disclosure requires kilolitres.', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', NULL, 'cmvt5880d00607kss8y4rwfso', 'SUB-2526-015', 'FY 2025-26', 'R. K. Sharma', 'OPEN', '', '', '2026-10-23T22:35:00.000Z', NULL, '2026-10-29T00:45:17.128Z', '2026-10-29T00:45:17.128Z'),
  ('cmvt5ftxe001n7kvojh2tp2ec', 'VLD-0022', 'LOW', 'PERIOD_MISMATCH', 'Submission tagged Q1 but measurement log covers April–June (Q2 window).', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', NULL, NULL, '', 'FY 2025-26', 'R. K. Sharma', 'OPEN', '', '', '2026-10-22T22:18:00.000Z', NULL, '2026-10-29T00:45:18.339Z', '2026-10-29T00:45:18.339Z'),
  ('cmvt5fuuf001o7kvobqadawbf', 'VLD-0023', 'MEDIUM', 'DUPLICATE', 'Two water withdrawal submissions reference the same meter log for June.', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', 'cmvt5843v002o7kssqjomr1hq', NULL, '', 'FY 2025-26', 'R. K. Sharma', 'OPEN', '', '', '2026-10-21T22:01:00.000Z', NULL, '2026-10-29T00:45:19.527Z', '2026-10-29T00:45:19.527Z'),
  ('cmvt5fvrp001p7kvo7oqsfehl', 'VLD-0024', 'HIGH', 'UNAPPROVED_SOURCE', 'Draft procurement entry feeds the green-spend ratio — source not yet approved.', 'cmvt5801g00037kssudyfd24t', 'cmvt5827v000o7kssiez5a1cg', NULL, NULL, '', 'FY 2025-26', 'R. K. Sharma', 'ASSIGNED', 'Shalini Verma', '', '2026-10-20T22:44:00.000Z', NULL, '2026-10-29T00:45:20.726Z', '2026-10-29T00:45:20.726Z'),
  ('cmvt5fwp2001q7kvo95oaxq6l', 'VLD-0025', 'HIGH', 'MISSING_EVIDENCE', 'Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002b7kssxf18hcgj', NULL, '', 'FY 2025-26', 'Arvind Mehta', 'OPEN', '', '', '2026-10-19T22:27:00.000Z', NULL, '2026-10-29T00:45:21.926Z', '2026-10-29T00:45:21.926Z'),
  ('cmvt5fxmk001r7kvogg2trhfb', 'VLD-0026', 'CRITICAL', 'MISSING_SUBMISSION', 'No waste disposal submission received for the current quarter — deadline within 7 days.', 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', NULL, NULL, '', 'FY 2025-26', 'Suresh Varma', 'OPEN', '', '', '2026-10-27T22:43:00.000Z', NULL, '2026-10-29T00:45:23.132Z', '2026-10-29T00:45:23.132Z'),
  ('cmvt5fyim001s7kvogntvvd1u', 'VLD-0027', 'MEDIUM', 'UNIT_MISMATCH', 'Diesel consumption reported in litres while the disclosure requires kilolitres.', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', NULL, 'cmvt587zu005a7kssiifgxqia', 'SUB-2526-004', 'FY 2025-26', 'Arvind Mehta', 'OPEN', '', '', '2026-10-26T22:26:00.000Z', NULL, '2026-10-29T00:45:24.286Z', '2026-10-29T00:45:24.286Z'),
  ('cmvt5fzg5001t7kvo4kichfao', 'VLD-0028', 'LOW', 'PERIOD_MISMATCH', 'Submission tagged Q1 but measurement log covers April–June (Q2 window).', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', NULL, NULL, '', 'FY 2025-26', 'Arvind Mehta', 'ASSIGNED', 'Divya Iyer', '', '2026-10-25T22:09:00.000Z', NULL, '2026-10-29T00:45:25.493Z', '2026-10-29T00:45:25.493Z'),
  ('cmvt5g0ld001u7kvonvonaouf', 'VLD-0029', 'MEDIUM', 'DUPLICATE', 'Two water withdrawal submissions reference the same meter log for June.', 'cmvt5801900017kssdbm9g6sp', 'cmvt5829f000w7kss4s9oe6uq', 'cmvt5842u002b7kssxf18hcgj', 'cmvt5880d005z7kssyjh2h2md', 'SUB-2526-014', 'FY 2025-26', 'Arvind Mehta', 'OPEN', '', '', '2026-10-24T22:52:00.000Z', NULL, '2026-10-29T00:45:26.715Z', '2026-10-29T00:45:26.715Z'),
  ('cmvt5g1i3001v7kvoanb8yi9e', 'VLD-0030', 'HIGH', 'UNAPPROVED_SOURCE', 'Draft procurement entry feeds the green-spend ratio — source not yet approved.', 'cmvt5801900017kssdbm9g6sp', 'cmvt5828z000u7kssqlf7nnl2', NULL, NULL, '', 'FY 2025-26', 'Suresh Varma', 'OPEN', '', '', '2026-10-23T22:35:00.000Z', NULL, '2026-10-29T00:45:28.155Z', '2026-10-29T00:45:28.155Z'),
  ('cmvt5g2gk001w7kvo0xbavjhu', 'VLD-0031', 'HIGH', 'MISSING_EVIDENCE', 'Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', 'cmvt583co001y7kssv4sfemdb', NULL, '', 'FY 2025-26', 'B. Shanker', 'OPEN', '', '', '2026-10-22T22:18:00.000Z', NULL, '2026-10-29T00:45:29.396Z', '2026-10-29T00:45:29.396Z'),
  ('cmvt5g4hd001y7kvo84vp77qg', 'VLD-0033', 'MEDIUM', 'UNIT_MISMATCH', 'Diesel consumption reported in litres while the disclosure requires kilolitres.', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', NULL, NULL, '', 'FY 2025-26', 'B. Shanker', 'OPEN', '', '', '2026-10-20T22:44:00.000Z', NULL, '2026-10-29T00:45:32.017Z', '2026-10-29T00:45:32.017Z'),
  ('cmvt5g5ew001z7kvo4o6ve96p', 'VLD-0034', 'LOW', 'PERIOD_MISMATCH', 'Submission tagged Q1 but measurement log covers April–June (Q2 window).', 'cmvt5803c00067kss8eawwp01', 'cmvt58104000k7ksspd0mp75f', NULL, NULL, '', 'FY 2025-26', 'Rohit Verma', 'OPEN', '', '', '2026-10-19T22:27:00.000Z', NULL, '2026-10-29T00:45:33.224Z', '2026-10-29T00:45:33.224Z'),
  ('cmvt5g6e600207kvoz5zil409', 'VLD-0035', 'MEDIUM', 'DUPLICATE', 'Two water withdrawal submissions reference the same meter log for June.', 'cmvt5803c00067kss8eawwp01', 'cmvt58103000g7ksso98pnla7', 'cmvt583co001y7kssv4sfemdb', NULL, '', 'FY 2025-26', 'B. Shanker', 'OPEN', '', '', '2026-10-27T22:43:00.000Z', NULL, '2026-10-29T00:45:34.494Z', '2026-10-29T00:45:34.494Z'),
  ('cmvt5g8vi00227kvo1dln1512', 'VLD-0037', 'HIGH', 'MISSING_EVIDENCE', 'Scope 1 stationary combustion report is missing the calibration certificate for the Q2 meter reading.', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', 'cmvt5842u00287kssfj1xhipu', NULL, '', 'FY 2025-26', 'Carlos Mendez', 'OPEN', '', '', '2026-10-25T22:09:00.000Z', NULL, '2026-10-29T00:45:37.710Z', '2026-10-29T00:45:37.710Z'),
  ('cmvt5ga2c00237kvom517e8ss', 'VLD-0038', 'CRITICAL', 'MISSING_SUBMISSION', 'No waste disposal submission received for the current quarter — deadline within 7 days.', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', NULL, NULL, '', 'FY 2025-26', 'Carlos Mendez', 'OPEN', '', '', '2026-10-24T22:52:00.000Z', NULL, '2026-10-29T00:45:39.252Z', '2026-10-29T00:45:39.252Z'),
  ('cmvt5gax300247kvodcau1x2a', 'VLD-0039', 'MEDIUM', 'UNIT_MISMATCH', 'Diesel consumption reported in litres while the disclosure requires kilolitres.', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', NULL, NULL, '', 'FY 2025-26', 'Carlos Mendez', 'OPEN', '', '', '2026-10-23T22:35:00.000Z', NULL, '2026-10-29T00:45:40.359Z', '2026-10-29T00:45:40.359Z'),
  ('cmvt5gbrn00257kvo94f8k4u3', 'VLD-0040', 'LOW', 'PERIOD_MISMATCH', 'Submission tagged Q1 but measurement log covers April–June (Q2 window).', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', NULL, NULL, '', 'FY 2025-26', 'Carlos Mendez', 'ASSIGNED', 'Elena Rossi', '', '2026-10-22T22:18:00.000Z', NULL, '2026-10-29T00:45:41.460Z', '2026-10-29T00:45:41.460Z'),
  ('cmvt5gehh00267kvosysv138i', 'VLD-0041', 'MEDIUM', 'DUPLICATE', 'Two water withdrawal submissions reference the same meter log for June.', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', 'cmvt5842u00287kssfj1xhipu', NULL, '', 'FY 2025-26', 'Carlos Mendez', 'OPEN', '', '', '2026-10-21T22:01:00.000Z', NULL, '2026-10-29T00:45:42.616Z', '2026-10-29T00:45:42.616Z'),
  ('cmvt5gffo00277kvohtx32dtf', 'VLD-0042', 'HIGH', 'UNAPPROVED_SOURCE', 'Draft procurement entry feeds the green-spend ratio — source not yet approved.', 'cmvt5802h00057kss5vcrhfln', 'cmvt5828r000q7kss9l8kynqq', NULL, NULL, '', 'FY 2025-26', 'Carlos Mendez', 'OPEN', '', '', '2026-10-20T22:44:00.000Z', NULL, '2026-10-29T00:45:46.212Z', '2026-10-29T00:45:46.212Z'),
  ('cmvt63efp000m7kj4yb5hmdad', 'VAL-BU-1001-002', 'WARNING', 'MISSING_EVIDENCE', 'Water withdrawal submission lacks the lab calibration certificate typically attached for meter accuracy verification.', 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt634bc00057kj46kasnt5n', '', 'FY 2025-26', '', 'OPEN', '', '', '2026-10-23T00:06:00.000Z', NULL, '2026-10-29T01:03:38.005Z', '2026-10-29T01:03:38.005Z'),
  ('cmvt63efp000n7kj4ctqutrie', 'VAL-BU-1001-003', 'CRITICAL', 'MISSING_EVIDENCE', 'Fly ash utilisation submission has zero supporting evidence — please attach the disposal log and consignment note.', 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001d7kssswxq54mz', 'cmvt6363r00077kj4hzqv3tlr', '', 'FY 2025-26', '', 'OPEN', '', '', '2026-10-27T04:22:00.000Z', NULL, '2026-10-29T01:03:38.005Z', '2026-10-29T01:03:38.005Z'),
  ('cmvt63efq000o7kj40uau296p', 'VAL-BU-1001-004', 'WARNING', 'UNIT_MISMATCH', 'Auxiliary power value (8.21%) appears inconsistent with the previous period (8.45%) — please confirm the unit-conversion basis for the resubmitted version.', 'cmvt57yuo00007kss94thg3ht', 'cmvt58101000a7kss1u47hng4', 'cmvt5836o001f7ksssq1ngm1s', 'cmvt637yg00097kj4529bfm54', '', 'FY 2025-26', '', 'OPEN', '', '', '2026-10-28T07:41:00.000Z', NULL, '2026-10-29T01:03:38.005Z', '2026-10-29T01:03:38.005Z'),
  ('cmvt63efq000p7kj4b9l34v98', 'VAL-BU-3002-002', 'WARNING', 'CALCULATION_EXCEPTION', 'Pipeline loss calculation reports 4.8% — the prior-period trend was 5.2%. Please verify the denominator basis (gross vs net supply).', 'cmvt5803c00067kss8eawwp01', 'cmvt582ba00107ksstpd3cm6s', 'cmvt5842y002k7kssuwfpe73x', 'cmvt63cm6000d7kj4pa8e6so9', '', 'FY 2025-26', '', 'OPEN', '', '', '2026-10-27T03:22:00.000Z', NULL, '2026-10-29T01:03:38.005Z', '2026-10-29T01:03:38.005Z');

-- Table "public"."ValidationResult" (0 rows)

-- Table "public"."ValidationRule" (0 rows)

-- Table "public"."WasteRecord" (4 rows)
INSERT INTO "public"."WasteRecord" ("id", "projectId", "reportingPeriodId", "module", "wasteType", "hazardous", "generatedQty", "recoveredQty", "recycledQty", "reusedQty", "disposedQty", "disposalRoute", "vendor", "manifestRef", "sourceUnit", "evidenceId", "validationStatus", "calculationStatus", "revisionNumber", "status", "enteredBy", "enteredAt", "updatedAt") VALUES
  ('cmvt6cje5003g7kxwbuvk8s53', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WASTE', 'E-waste', TRUE, 0.8, 0.75, 0.75, 0, 0.05, 'Authorised Recycler', 'Ecoreco', 'EWM-PVAN-04-01', 'TON', NULL, 'PASSED', 'PENDING', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:44.333Z', '2026-10-29T01:10:44.333Z'),
  ('cmvt6cka9003i7kxwkes1qsgv', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WASTE', 'DG Oil Sludge', TRUE, 1.2, 0.9, 0.9, 0, 0.3, 'TSDF', 'Ramky', 'EWM-PVAN-04-02', 'TON', NULL, 'PASSED', 'PENDING', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:45.488Z', '2026-10-29T01:10:45.488Z'),
  ('cmvt6cl5b003k7kxwc80wdfyq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WASTE', 'Solar Panel Scrap', FALSE, 2.4, 2.3, 2.3, 0, 0.1, 'Recycler', 'Renewsys', 'EWM-PVAN-04-03', 'TON', NULL, 'PASSED', 'PENDING', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:46.606Z', '2026-10-29T01:10:46.606Z'),
  ('rec-l4-mw2tuhlu-g5iq', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'WASTE', 'Construction & demolition', FALSE, 17.2, 0, 5.2, 10.5, 1.5, NULL, NULL, 'CDW-MANIFEST-2026-0102', 'metric tonnes', NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T19:18:28.615Z', '2026-11-04T19:18:28.615Z');

-- Table "public"."WaterRecord" (6 rows)
INSERT INTO "public"."WaterRecord" ("id", "projectId", "reportingPeriodId", "module", "source", "withdrawal", "consumption", "discharge", "recycledReused", "treatment", "destination", "sourceUnit", "waterStress", "zldActive", "evidenceId", "validationStatus", "calculationStatus", "revisionNumber", "status", "enteredBy", "enteredAt", "updatedAt") VALUES
  ('cmvt6choo003c7kxwecd7z29v', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'WATER', 'Ground Water', 4200, 1260, 800, 2140, 'STP', 'Irrigation', 'KL', TRUE, TRUE, NULL, 'PASSED', 'PENDING', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:41.926Z', '2026-10-29T01:10:41.926Z'),
  ('cmvt6cij5003e7kxwq651wwp5', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6aee700067kxwsqtxlpql', 'WATER', 'Ground Water', 4600, 1380, 900, 2320, 'STP', 'Irrigation', 'KL', TRUE, TRUE, NULL, 'PASSED', 'PENDING', 1, 'APPROVED', 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:43.217Z', '2026-10-29T01:10:43.217Z'),
  ('rec-l2-mw2dqvql-lrte', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'WATER', 'Groundwater', 24500, 18300, NULL, 6200, 'RO / ZLD', 'Zero Liquid Discharge (ZLD)', 'kL', FALSE, FALSE, NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T11:47:46.418Z', '2026-11-04T11:47:46.418Z'),
  ('rec-l2-mw2g6jq6-65zt', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'WATER', 'Groundwater', 24500, 18300, NULL, 6200, 'RO / ZLD', 'Zero Liquid Discharge (ZLD)', 'kL', FALSE, FALSE, NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T12:55:56.581Z', '2026-11-04T12:55:56.581Z'),
  ('rec-l2-mw2gxlyp-axp4', 'cmvt5836p001t7kssxjh733ng', 'cmvt6ag9q00087kxwvb2pkxhx', 'WATER', 'Groundwater', 24500, 18300, NULL, 6200, 'RO / ZLD', 'Zero Liquid Discharge (ZLD)', 'kL', FALSE, FALSE, NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T13:16:59.191Z', '2026-11-04T13:16:59.191Z'),
  ('rec-l2-mw2ttrhq-u3iy', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6ag9q00087kxwvb2pkxhx', 'WATER', 'Groundwater', 24500, 18300, NULL, 6200, 'RO / ZLD', 'Zero Liquid Discharge (ZLD)', 'kL', FALSE, FALSE, NULL, 'PASSED', 'PENDING', 1, 'DRAFT', 'Rohit Kumar', '2026-11-04T19:17:54.751Z', '2026-11-04T19:17:54.751Z');

-- Table "public"."WorkforceRecord" (2 rows)
INSERT INTO "public"."WorkforceRecord" ("id", "projectId", "reportingPeriodId", "module", "category", "permanent", "nonPermanent", "male", "female", "other", "differentlyAbled", "newHires", "exits", "trainingHours", "evidenceId", "validationStatus", "status", "revisionNumber", "enteredBy", "enteredAt", "updatedAt") VALUES
  ('cmvt6clzm003m7kxwo7sxs7it', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'PEOPLE', 'EMPLOYEE', 42, 8, 38, 12, 0, 1, 2, 1, 312, NULL, 'PASSED', 'APPROVED', 1, 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:47.698Z', '2026-10-29T01:10:47.698Z'),
  ('cmvt6cmvk003o7kxwnp15z1yd', 'cmvt5842u002c7kssl8jciq2c', 'cmvt6acpg00047kxwgjmt06r8', 'PEOPLE', 'WORKER', 18, 34, 48, 4, 0, 0, NULL, NULL, 184, NULL, 'PASSED', 'APPROVED', 1, 'cmvt596uj00017k44uqelt2ry', '2026-10-29T01:10:48.848Z', '2026-10-29T01:10:48.848Z');

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- End of Dump (926 total records)
