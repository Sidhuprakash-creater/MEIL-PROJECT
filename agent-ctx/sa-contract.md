# MEIL Subsidiary Admin — /api/sa/* CONTRACT (single source of truth)

Every route: `export const dynamic = "force-dynamic";` and wrapped in `saHandle`.
Every handler starts with `const ctx = await requireSubsidiaryAdmin();` — `ctx.subsidiaryId`
is the ONLY scope. All queries MUST filter by it (directly or via scoped relations).
Error style: `throw new SaError("message", status)` → JSON `{ error }` with that status.

Imports available:
```ts
import { ok, fail } from "@/lib/esg/server";            // ok(data), fail(message, status)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  saHandle, requireSubsidiaryAdmin, SaError, saLogActivity, saLogAudit, saNotify,
  getSubsidiaryOrThrow, assertUnitInScope, assertProjectInScope, assertUserInScope,
  ASSIGNABLE_ROLES, ROLE_LABELS, resolveEffectiveDeadline, deadlineStatus, parseJson,
} from "@/lib/sa/server";
```

Prisma models (see prisma/schema.prisma): Subsidiary, BusinessUnit, Project, User,
Submission (values/evidence/comments/history = JSON strings), ReportingTimeline,
ReportingPackage, ValidationIssue, EvidenceDoc, Notification (subsidiaryId nullable —
null = group-wide), Message, ActivityEvent, AuditEvent, Task, AppSetting.

Concurrency-safe reference counters: use DB count + random suffix, e.g.
`const seq = (await db.reportingTimeline.count()) + 1; ref = \`RTL-${String(seq).padStart(4,"0")}-${Math.random().toString(36).slice(2,6)}\``
— but refs must be UNIQUE; if a collision error occurs, retry once with a new suffix.
Simpler safe pattern: `ref: \`RTL-${Date.now().toString(36).toUpperCase()}\``.

---
## GET /api/sa/dashboard?period=FY+2025-26
Returns `DashboardData` (see src/lib/sa/types.ts): { subsidiary, period, kpis, buStatusDist,
prjStatusDist, completionByBU, submissionTrend, upcomingDeadlines, overdueItems, recentActivity }.

Computation rules:
- Scope: `where: { subsidiaryId: ctx.subsidiaryId }` for everything (submissions too).
- BU reports = submissions with `level==="BU"` (projectId == null); Project reports = projectId != null.
- Status buckets: SUBMITTED+UNDER_REVIEW = "Submitted/pending review" (kpis.buSubmitted counts both, buPending = SUBMITTED+UNDER_REVIEW not overdue... see below); pending = SUBMITTED|UNDER_REVIEW; awaitingReview = UNDER_REVIEW; DRAFT+ASSIGNED = outstanding/pending work; overdue = overdue flag OR dueDate < now with status not in (APPROVED).
  Concretely: buSubmitted = count(status SUBMITTED|UNDER_REVIEW) · buPending = count(DRAFT|ASSIGNED) · buOverdue = overdue && status not APPROVED · buApproved = APPROVED · buRejected = REJECTED|CHANGES_REQUESTED.
- completionPct = approved / total (0 if none).
- buStatusDist / prjStatusDist: [{status, count}] over all 7 statuses.
- completionByBU: per BU {name,total,approved,pending,overdue,completionPct}.
- submissionTrend: last 6 months buckets by submittedAt → {label:"Apr", submitted, approved}.
- upcomingDeadlines: next 5 effective deadlines (timelines walk: resolveEffectiveDeadline over ACTIVE timelines of the subsidiary) with daysLeft, status via deadlineStatus().
- overdueItems: submissions overdue && !APPROVED → top 6 by dueDate asc {ref,title,level:"BU"|"PROJECT",org:buName||projectName,dueDate,daysLate,owner:submittedByName||"—"}.
- recentActivity: last 8 ActivityEvent where orgLabel == subsidiary.name, desc.
- activeUsers: User ACTIVE with lastActiveAt within 30 min.

## GET /api/sa/pulse
→ `{ version: string, at: string, unread: number }`.
version = `${maxSubmissionUpdatedAt}-${maxNotificationUpdatedAt}-${maxUnitUpdatedAt}` (epoch ms values concatenated).
unread = scoped unread notification count (subsidiaryId == ctx.subsidiaryId OR null).

## GET /api/sa/notifications?filter=all|unread&category=&limit=&days=
→ `{ notifications: SaNotification[], unread }`. Scope: `subsidiaryId = ctx.subsidiaryId OR null`
(group-wide announcements included; mark origin: "group" when subsidiaryId === null, else "subsidiary").
Sort desc, limit default 50.
## PATCH /api/sa/notifications
Body `{ ids?: string[], all?: boolean, read: boolean }` → updates scoped notifications only
(subsidiaryId == ctx.subsidiaryId OR null, and only ids present in that filtered set).

## Units
### GET /api/sa/units?q=&status=&page=&pageSize= (default 8, max 50)
→ `{ units: UnitRow[], total, page, pageSize }`. UnitRow per types.ts. Stats from scoped
submissions grouped by businessUnitId. completionPct = approved/total*100 rounded.
### POST /api/sa/units
Body { name, code?, description?, managerName?, adminName?, status? }.
- name required (2-80 chars) → 400 SaError on invalid.
- code optional; if omitted auto `BU-${subCode part}-${n}`; enforce unique (409 "BU code already exists").
- Always sets subsidiaryId = ctx.subsidiaryId (the admin CANNOT choose another parent).
- Creates ActivityEvent (action "BU_CREATE", orgLabel sub.name), AuditEvent (orgScope sub.code, before {} after row),
  and scoped saNotify ({ntype:"SYSTEM", title:"Business unit created", body:..., subsidiaryId: ctx.subsidiaryId}).
→ 201 { unit: UnitRow }.
### GET /api/sa/units/[id]
→ detail: `{ unit: UnitRow, projects: ProjectRow[], users: UserRow[], submissions: SubmissionRow[], timelines: TimelineRow[], activity: ActivityRow[] }` (top 10 each, scoped checks: 403 if not in subsidiary).
### PATCH /api/sa/units/[id]
Body { name?, description?, managerName?, adminName?, status? } — status ACTIVE|INACTIVE.
Audit with before/after. Deactivation allowed anytime (history preserved).
### DELETE /api/sa/units/[id]
If unit has projects or users → SaError 409 "This business unit has N projects and M users. Deactivate it instead to preserve reporting history."
Else delete + audit.

## Projects
### GET /api/sa/projects?q=&buId=&status=&page=&pageSize=
→ `{ projects: ProjectRow[], total, buFacets: {id,name}[], page, pageSize }`.
ProjectRow.responsibleName = first assigned user name or "—". dueDate = effective deadline via timelines.
validationState = worst open validation issue severity or "OK".
### POST /api/sa/projects
Body { name, code?, buId, location?, ptype?, capacityMw?, frequency?, responsibleUserId?, status? }.
- buId MUST pass assertUnitInScope(buId, ctx.subsidiaryId) → else 403 "This business unit is outside your assigned subsidiary."
- code auto if omitted `PRJ-${...}`; unique → 409.
- responsibleUserId optional; if set must be a user in scope (assertUserInScope) and gets projectId set.
→ 201 { project: ProjectRow } + activity/audit/notify.
### GET /api/sa/projects/[id] → { project: ProjectRow, team: UserRow[], submissions: SubmissionRow[], evidence: EvidenceRow[], timelines: TimelineRow[], tasks: Task[], activity: ActivityRow[] } (403 out of scope).
### PATCH /api/sa/projects/[id] — name/location/ptype/capacityMw/frequency/responsibleUserId/status (BU move allowed only within subsidiary: assertUnitInScope).
### DELETE — if submissions exist → 409 (deactivate instead); else delete + audit.

## Users
### GET /api/sa/users?q=&role=&status=&buId=&page=&pageSize=
→ `{ users: UserRow[], total, roles: string[], page, pageSize }`. Scoped to subsidiaryId.
Excludes nothing (subsidiary admins/managers included; GROUP_ADMIN/ORG_MANAGER never in list).
presence: online (<30min), today (<12h), away (<36h), offline.
taskCount = Task rows where assigneeFilter JSON contains user OR assigneeType USER && assigneeLabel == name (approx: count tasks where assigneeFilter contains user id, else 0), submissionCount = submissions submittedById.
### POST /api/sa/users
Body { name, email, role, title?, phone?, buId?, projectId? }.
- role MUST be in ASSIGNABLE_ROLES → else 403 "This role cannot be granted from a subsidiary workspace."
- email unique → 409. Create status "INVITED" (no password). employeeId auto `EMP-xxxx` if absent.
- scope fields must be in-subsidiary.
→ 201 { user: UserRow } + audit USER_CREATE + activity.
### GET /api/sa/users/[id]
→ { user: UserRow, tasks: Task[], submissions: SubmissionRow[], activity: ActivityRow[], sessions: {id, userAgent, ip, createdAt, expiresAt}[], lastLogins: AuditLog[] } (assertUserInScope).
### PATCH /api/sa/users/[id]
Body { title?, phone?, role?, buId?, projectId?, status? }.
- role change: must be ASSIGNABLE_ROLES. Cannot change own account's role (403 "You cannot change your own role."). 
- status: ACTIVE|SUSPENDED|INACTIVE. Cannot change own account status (403).
- Audit with before/after; role change notifies user-scoped notification.
### POST /api/sa/users/[id]/actions
Body { action: "suspend"|"activate"|"deactivate"|"reset-credential" }.
- suspend → status SUSPENDED; activate → ACTIVE; deactivate → INACTIVE.
- reset-credential: generate 12-char temp password (crypto), hashPassword (src/lib/password), store,
  revoke existing Sessions, audit PASSWORD_RESET, activity. → { tempPassword } shown ONCE in UI.
  (Honest demo of credential recovery — no email provider in sandbox.)

## Roles
### GET /api/sa/roles
→ RolesData per types.ts: roles[] (11 roles w/ descriptions, assignable flag = in ASSIGNABLE_ROLES,
userCount in subsidiary, permissions list), matrix[] (capabilities × grants full/own/none),
assignmentGaps (ACTIVE users whose buId/projectId null for BU/project-scoped roles),
changeHistory (AuditEvent action ROLE_*, orgScope subCode, top 12).

## Timelines
### GET /api/sa/timelines?period=
→ `{ timelines: TimelineRow[], summary: TimelineSummary }`.
- Load ACTIVE timelines for subsidiary (+period filter optional).
- Rows: each timeline joined with org name (subsidiary itself / BU / project) + effective deadline via resolveEffectiveDeadline + deadlineStatus computed from that entity's submissions (hasSubmitted = any non-DRAFT submission in period, allApproved = all APPROVED).
- summary.subsidiaryDeadline = root effective dueDate; counts: BU complete = BUs whose deadlineStatus in (SUBMITTED_ON_TIME, CLOSED); pending = IN_PROGRESS/DUE_SOON/UPCOMING/NOT_STARTED; overdue = OVERDUE/SUBMITTED_LATE. Same for projects. overrides = count OVERRIDE rows. upcoming = next 5 deadlines asc.
### POST /api/sa/timelines
Body { name, period, level: "SUBSIDIARY"|"BUSINESS_UNIT"|"PROJECT", orgId?, startDate, dueDate?, reviewDeadline?, categories?: string[], inheritanceMode: "INHERIT"|"OVERRIDE", overrideReason?, notify?, status? }.
- level SUBSIDIARY: orgId ignored (self). Only one ACTIVE root per period: upsert/replace (409 if exists? no — update it and audit TIMELINE_UPDATE).
- level BUSINESS_UNIT: assertUnitInScope. level PROJECT: assertProjectInScope.
- OVERRIDE requires overrideReason (400) and dueDate.
- Validate startDate < dueDate, reviewDeadline >= dueDate when present (400 otherwise).
- Respond 201 { timeline, affected: {buCount, projectCount} } where affected = count of children that inherit this node (recipients of the cascade).
- Notifications: saNotify scoped "Reporting timeline updated" + per affected BU/project manager? (just one scoped notify + audit TIMELINE_CREATE).
### PATCH /api/sa/timelines/[id]
Same validations; audit TIMELINE_UPDATE with before/after; → { timeline, affected }.
### DELETE /api/sa/timelines/[id] → deletes (children fall back to inherit); audit; → { ok: true }.

## Submissions (register + monitoring + detail)
### GET /api/sa/submissions?tab=all|draft|submitted|pending|approved|rejected|overdue&q=&category=&buId=&projectId=&userId=&period=&level=BU|PROJECT&page=&pageSize=
- tab mapping: draft→DRAFT|ASSIGNED, submitted→SUBMITTED, pending→UNDER_REVIEW, approved→APPROVED, rejected→REJECTED|CHANGES_REQUESTED, overdue→overdue flag && status != APPROVED, all→everything.
- level: BU → projectId null; PROJECT → projectId != null.
→ `{ submissions: SubmissionRow[], total, page, pageSize, counts: { all, draft, submitted, pending, approved, rejected, overdue } }`.
SubmissionRow.level: projectId? "PROJECT" : "BU". submittedByName/reviewerName joined. evidenceCount = evidence array length.
### GET /api/sa/submissions/[id]
→ { submission: SubmissionDetail } — assert scope via businessUnit.subsidiaryId (403 otherwise).
SubmissionDetail includes values/evidence/comments/history parsed from JSON + validationIssues (ValidationIssue where submissionId).

## Evidence
### GET /api/sa/evidence?q=&buId=&projectId=&type=&status=&page=&pageSize=
→ `{ docs: EvidenceRow[], total, summary: EvidenceSummary, page, pageSize }` (scoped by subsidiaryId).
### GET /api/sa/evidence/[id]
→ { doc: EvidenceRow & { previewAvailable: boolean, contentHash: string } } — contentHash = sha8 of name+uploadedAt (stable demo value, honest metadata).
### GET /api/sa/evidence/[id]/download
→ returns a small generated text file (Content-Disposition attachment) named after the doc with a
metadata header (doc name, ref, disclosureRef, uploadedBy, uploadedAt, version) + demo content line.
Honest: this is a metadata receipt for the demo document, clearly labelled inside the file.

## Messages
### GET /api/sa/messages
→ { messages: MessageRow[] } — messages where (channel in ("SUBSIDIARY","BU","DIRECT","ROLE_GROUP") AND audienceFilter JSON subsidiaryId == ctx.subsidiaryId) OR (channel == "GROUP_WIDE") OR sentBy in subsidiary admins' names. origin: "group" when channel GROUP_WIDE or sentBy a group admin, else "subsidiary". Sort desc, top 60.
### POST /api/sa/messages
Body { kind: "MESSAGE"|"ANNOUNCEMENT"|"REMINDER", channel: "DIRECT"|"ROLE_GROUP"|"BU"|"SUBSIDIARY", subject, body, role?, buId?, userIds?: string[], period?, scheduledFor? }.
- Recipients computed within subsidiary: DIRECT → userIds (must be in scope); ROLE_GROUP → role (+optional buId); BU → all users of BU; SUBSIDIARY → all ACTIVE subsidiary users.
- recipients 0 → 400 "No eligible recipients for this audience."
- Create Message: channel stays chosen, audienceFilter JSON includes subsidiaryId, sentBy = ctx.name, status SENT or SCHEDULED, delivered = recipients (SENT).
- Create scoped Notification (ntype MESSAGE, title = subject, subsidiaryId) + audit COMM_SEND + activity.
→ 201 { message: MessageRow }.

## ESG Reporting & Packages
### GET /api/sa/esg?period=
→ EsgReportingData per types.ts.
- readiness.pct = approved / (total non-draft) *100; eligibleApproved, pendingReview (SUBMITTED+UNDER_REVIEW), missingData = categories with zero submissions count, validationExceptions = open ValidationIssues, evidenceGaps = EvidenceDoc MISSING + submissions with zero evidence.
- categories[]: per category totals + completionPct + missing flag.
- consolidation[]: group APPROVED submissions by metricName+unit → approvedTotal sum, pendingTotal (UNDER_REVIEW/SUBMITTED excluded from approved totals), sources list (ref,label: title,org,value,status,hasIssues from validation refs).
- buCompletion[] per BU.
- packages[] (ReportingPackage rows for subsidiary, desc) mapped to PackageRow.
- activeFeedback: newest CHANGES_REQUESTED package → {ref, feedback: groupFeedback, at: updatedAt}.
### POST /api/sa/packages
Body { title?, period, sourceRefs?: string[] }.
- Compute current consolidation snapshot (approved sources; allow pending flagged in summary).
- readinessPct as above. If zero approved sources → 400 "There are no approved records to include yet."
- Create ReportingPackage status "SUBMITTED", submittedAt now, submittedBy ctx.name.
- Group visibility: saNotify({ ntype:"PACKAGE", title:"Subsidiary reporting package submitted", body:`${sub.name} submitted ${title} for Group consolidation.`, subsidiaryId: null }) — appears on the Group Admin bell. Also scoped notification + audit PACKAGE_SUBMIT + activity.
→ 201 { package: PackageRow }.
### PATCH /api/sa/packages/[id]
Only for CHANGES_REQUESTED packages: body { action: "resubmit", sourceRefs? } → status back to SUBMITTED, audit, group notify. (Group Admin keeps decision ownership.)

## Validation
### GET /api/sa/validation?severity=&status=&buId=&projectId=&q=&page=&pageSize=
→ `{ issues: ValidationRow[], total, summary: { open, critical, assigned, resolved } }` scoped.
### PATCH /api/sa/validation/[id]
Body { action: "assign", ownerName } — sets ASSIGNED (+audit +scoped notify to correction owner).
Body { action: "resolve", note? } — REAL revalidation server-side:
- MISSING_EVIDENCE: requires linked submission evidence array non-empty (or an EvidenceDoc exists for the submissionRef) → else 409 "Linked submission still has no evidence attached. Upload it before resolving."
- MISSING_SUBMISSION: requires an APPROVED-or-later submission exists for that BU + period in any category → else 409.
- DUPLICATE: requires the two source records no longer both exist — accept when note provided (documented exception) → resolves with note.
- others: require note (400 "A resolution note is required for this issue type.").
- Audit VALIDATION_RESOLVE (outcome SUCCESS/FAILURE), activity on success.

## Analytics
### GET /api/sa/analytics?period=
→ AnalyticsData per types.ts: completionByBU, submissionTrend (6 months), statusMix (7 statuses),
overdueByBU, metricTrends (12 months: energy GJ '000, emissions tCO2e '00, water m³ '00, waste t, safety incidents — derived from approved submission values per category by month; zero-fill), qualityDist (open validation by severity), pendingVsApproved (6 months), categoryPulse (latest approved metric per category with % change vs prior value).

## Activity & Audit
### GET /api/sa/activity?q=&action=&user=&days=30
→ { events: ActivityRow[] } — ActivityEvent where orgLabel == subsidiary.name (all subsidiary-scoped rows) sorted desc top 100. Filters applied post-query.
### GET /api/sa/audit?q=&outcome=&days=90
→ { events: AuditRow[] } — AuditEvent where orgScope == subsidiary.code, desc, top 100.

## Settings
### GET /api/sa/settings
→ {
  profile: SubsidiaryInfo,
  contact: { email, phone, reportingContact } (reportingContact from AppSetting skey `sa:<subId>:contact`),
  preferences: { deadlineReminders, submissionAlerts, weeklyDigest, emailEscalation } (AppSetting skey `sa:<subId>:prefs`),
  reportingConfig: { mandatedPeriods: ["FY 2024-25","FY 2025-26"], disclosureCatalogue: "SEBI BRSR Core v1.0 (Group-mandated)", inheritanceRule: "Subsidiary → BU → Project (overrides recorded)", timelineLocked: false },
  integrations: { syncStatus: "OPERATIONAL", lastSyncAt: <max updatedAt across submissions>, failedJobs: 0 },
  security: { sessions: [...current user's active sessions], recentAuth: AuditLog[] (top 8) }
}
### PATCH /api/sa/settings
Body { contact?: { email?, phone?, reportingContact? }, preferences?: {...} } — writes AppSetting rows (upsert). Audit CONFIG_CHANGE. Profile name/sector NOT editable from subsidiary (read-only per policy — include in response as info).

## Conventions
- All list endpoints: clamp page ≥ 1, pageSize ≤ 50; return `{ total, page, pageSize }`.
- Dates out: ISO strings.
- saLogActivity(ctx, sub.name, {...}) / saLogAudit(ctx, sub.code, {...}) on EVERY mutation.
- Never create/modify Submission.status transitions (no approve/reject endpoints).
- Never read/write rows outside ctx.subsidiaryId (assert* helpers throw 403).
