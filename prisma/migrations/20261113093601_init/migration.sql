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
    "googleSub" TEXT,
    "googleEmail" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'CREDENTIALS',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
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
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedIdentifier" TEXT NOT NULL,
    "portal" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING_ADMIN',
    "approverId" TEXT,
    "approverRole" TEXT,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
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
    "forwardedToBu" BOOLEAN NOT NULL DEFAULT false,
    "forwardedToBuAt" TIMESTAMP(3),
    "inConsolidatedReport" BOOLEAN NOT NULL DEFAULT false,
    "consolidatedReportId" TEXT,
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
CREATE TABLE "BrsrSubsidiaryData" (
    "id" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "subsidiaryName" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT 'FY 2025-26',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sections" TEXT NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrsrSubsidiaryData_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "CopilotConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT NOT NULL DEFAULT '',
    "context" TEXT NOT NULL DEFAULT '{}',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "meta" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotToolExecution" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "args" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "resultSummary" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CopilotToolExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotConfirmation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "args" TEXT NOT NULL DEFAULT '{}',
    "summary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "executedResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotSavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotSavedItem_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleEmail_key" ON "User"("googleEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetRequest_tokenHash_key" ON "PasswordResetRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_userId_status_idx" ON "PasswordResetRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_status_createdAt_idx" ON "PasswordResetRequest"("status", "createdAt");

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
CREATE INDEX "BrsrSubsidiaryData_subsidiaryId_idx" ON "BrsrSubsidiaryData"("subsidiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "BrsrSubsidiaryData_subsidiaryId_period_key" ON "BrsrSubsidiaryData"("subsidiaryId", "period");

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

-- CreateIndex
CREATE INDEX "CopilotConversation_userId_lastAt_idx" ON "CopilotConversation"("userId", "lastAt");

-- CreateIndex
CREATE INDEX "CopilotMessage_conversationId_createdAt_idx" ON "CopilotMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotToolExecution_conversationId_startedAt_idx" ON "CopilotToolExecution"("conversationId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CopilotConfirmation_token_key" ON "CopilotConfirmation"("token");

-- CreateIndex
CREATE INDEX "CopilotConfirmation_userId_status_idx" ON "CopilotConfirmation"("userId", "status");

-- CreateIndex
CREATE INDEX "CopilotSavedItem_userId_createdAt_idx" ON "CopilotSavedItem"("userId", "createdAt");

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
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotToolExecution" ADD CONSTRAINT "CopilotToolExecution_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotToolExecution" ADD CONSTRAINT "CopilotToolExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotConfirmation" ADD CONSTRAINT "CopilotConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotSavedItem" ADD CONSTRAINT "CopilotSavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
