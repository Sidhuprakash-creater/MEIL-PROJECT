/**
 * PU-LINK — the bridge that connects the Project User Portal (site operations
 * users) to the main platform hierarchy (BU → Subsidiary → Group).
 *
 * The portal and the platform now share ONE unified ledger (same User,
 * Project, Submission, Evidence, Notification tables). The bridge therefore
 * no longer copies rows between databases — it ENRICHES the shared submission
 * (scope columns, category, values rollup), writes platform-side events so
 * Subsidiary Manager / Group Admin queues and bells light up, and reflects
 * decisions back so the sender always sees the receiver's outcome.
 *
 * OUTBOUND (portal → platform):  mirrorPuSubmission
 * INBOUND  (platform → portal):   syncDecisionToPu
 * TASKS    (platform → portal):   pushTaskToPortalUsers
 *
 * Everything here is best-effort: a bridge failure logs a warning and never
 * breaks the primary API call. The shared Prisma contract runs on SQLite
 * today and PostgreSQL/Supabase tomorrow.
 */
import { db } from "@/lib/db";

/* ── logging ─────────────────────────────────────────────────────────────── */

const log = (...args: unknown[]) => console.log("[pu-link]", ...args);
const warn = (...args: unknown[]) => console.warn("[pu-link]", ...args);

/* ── org mapping: submission → platform scope ────────────────────────────── */

export interface MainScope {
  subsidiaryId: string | null;
  businessUnitId: string | null;
  projectId: string | null;
  label: string;
}

/**
 * Resolve the platform scope for a portal project. With the unified ledger
 * the portal project IS the platform project — scope comes straight from its
 * BusinessUnit → Subsidiary chain (sector-keyword fallback only when the
 * hierarchy link is missing).
 */
export async function mapPuProjectToMainScope(
  puProjectId: string
): Promise<MainScope> {
  const project = await db.project.findUnique({
    where: { id: puProjectId },
    include: { businessUnit: { include: { subsidiary: true } } },
  });
  if (!project) {
    return { subsidiaryId: null, businessUnitId: null, projectId: null, label: "Unmapped" };
  }
  const unit = project.businessUnit;
  const sub = unit?.subsidiary ?? null;
  if (unit || sub) {
    return {
      subsidiaryId: sub?.id ?? null,
      businessUnitId: unit?.id ?? null,
      projectId: project.id,
      label: [sub?.name, unit?.name, project.name].filter(Boolean).join(" · "),
    };
  }
  return {
    subsidiaryId: null,
    businessUnitId: null,
    projectId: project.id,
    label: project.name,
  };
}

/* ── system identity (attribution for platform-side writes) ──────────────── */

let puSystemUserId: string | null = null;

/**
 * Stable system identity used only when a bridge write has no human actor.
 * Platform reviewers are real users on the unified ledger, so their own ids
 * are preferred; this is the last-resort fallback.
 */
export async function ensurePuSystemUser(): Promise<string> {
  if (puSystemUserId) return puSystemUserId;
  const email = "platform-reviewer@meil.in";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    puSystemUserId = existing.id;
    return existing.id;
  }
  const admin = await db.user.findFirst({ where: { role: "GROUP_ADMIN" }, select: { id: true } });
  if (admin) {
    puSystemUserId = admin.id;
    return admin.id;
  }
  const created = await db.user.create({
    data: { email, name: "Platform Reviewer", role: "ENV_DATA_USER", status: "ACTIVE" },
  }).catch(() => db.user.findUnique({ where: { email } }));
  if (!created) throw new Error("Failed to ensure platform system user");
  puSystemUserId = created.id;
  return created.id;
}

/* ── category mapping ────────────────────────────────────────────────────── */

export function moduleToCategory(module: string | null | undefined): string {
  const m = String(module ?? "").toUpperCase();
  if (m.startsWith("LEVEL_")) return moduleToCategory(m.replace(/^LEVEL_\d+_/, ""));
  switch (m) {
    case "ENERGY": return "ENERGY";
    case "WATER": return "WATER";
    case "WASTE": return "WASTE";
    case "SAFETY": case "INCIDENTS": return "SAFETY";
    case "PEOPLE": case "TRAINING": return "WORKFORCE";
    case "TRAVEL": return "EMISSIONS";
    case "EMISSIONS": return "EMISSIONS";
    case "COMPLIANCE": return "COMPLIANCE";
    case "INITIATIVES": return "CSR";
    default: return "ENVIRONMENT";
  }
}

/* ── values extraction (from portal level-records + source records) ─────── */

interface ValueRow { label: string; value: number | string; unit: string }

async function extractValues(
  recordIds: string[],
  module: string
): Promise<ValueRow[]> {
  const out: ValueRow[] = [];
  try {
    const { getLevelRecordById } = await import("@/lib/pu/level-records");
    for (const id of recordIds) {
      const lr = getLevelRecordById(id) as Record<string, unknown> | null;
      if (!lr) continue;
      const data = (lr.data ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(data)) {
        if (v === null || v === undefined || v === "") continue;
        const label = k
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (c) => c.toUpperCase())
          .trim();
        if (typeof v === "number") out.push({ label, value: v, unit: String(lr.unit ?? "") });
        else if (typeof v === "string" || typeof v === "boolean") {
          out.push({ label, value: String(v), unit: "" });
        }
      }
    }
  } catch (e) {
    warn("extractValues level-records failed", e);
  }
  // Trim to a reviewable size and de-dup labels
  const seen = new Set<string>();
  const trimmed: ValueRow[] = [];
  for (const row of out) {
    const key = row.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    trimmed.push(row);
    if (trimmed.length >= 12) break;
  }
  if (trimmed.length === 0) {
    trimmed.push({ label: "Module", value: module, unit: "" });
  }
  return trimmed;
}

/* ── JSON column helpers ─────────────────────────────────────────────────── */

export function parseJsonArraySafe(raw: string | null | undefined): Record<string, unknown>[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseRecordIdsSafe(raw: string | null | undefined): string[] {
  return parseJsonArraySafe(raw).map((x) => String(x));
}

function appendJson<T>(raw: string | null | undefined, entry: T): T[] {
  return [...parseJsonArraySafe(raw), entry] as T[];
}

/* ── evidence mirroring ──────────────────────────────────────────────────── */

async function mirrorEvidence(
  recordIds: string[],
  ref: string,
  scopeLabel: string,
  submitterName: string
): Promise<string[]> {
  // Evidence files already live on the shared Evidence rows (linked to the
  // source records). Return their file names for the submission's evidence
  // sheet so reviewers can preview them without leaving their console.
  try {
    const rows = await db.evidence.findMany({
      where: { sourceRecordId: { in: recordIds } },
      select: { fileName: true, status: true },
      take: 20,
    });
    return rows.map((r) => `${r.fileName} (${r.status})`);
  } catch (e) {
    warn("mirrorEvidence notice", e);
    return [];
  }
}

/* ── OUTBOUND: portal submission → platform visibility ──────────────────── */

export interface MirrorResult {
  ok: boolean;
  mainSubmissionId?: string;
  mainRef?: string;
  scopeLabel?: string;
  reason?: string;
}

/**
 * Enrich the shared submission for platform consumption + notify the review
 * chain. The row is ALREADY visible to every console (one ledger) — this
 * fills scope/category/values, appends events, and rings the right bells.
 */
export async function mirrorPuSubmission(
  puSubmissionId: string,
  opts: { phase: "SUBMITTED" | "RESUBMITTED"; actorId: string; actorName: string; actorRole: string }
): Promise<MirrorResult> {
  try {
    const pu = await db.submission.findUnique({
      where: { id: puSubmissionId },
      include: {
        project: { include: { businessUnit: { include: { subsidiary: true } } } },
        reportingPeriod: { select: { id: true, periodLabel: true, submissionDeadline: true } },
      },
    });
    if (!pu) return { ok: false, reason: "submission not found" };
    if (pu.status === "DRAFT") return { ok: false, reason: "still draft" };

    const scope = await mapPuProjectToMainScope(pu.projectId ?? "");
    const recordIds = parseRecordIdsSafe(pu.recordIds);
    const ref = `PU-${pu.id}`;
    const now = new Date();

    // 1. Enrich the shared row: scope columns, category, values rollup
    const values = await extractValues(recordIds, pu.module ?? "");
    const category = moduleToCategory(pu.module);
    await db.submission.update({
      where: { id: pu.id },
      data: {
        subsidiaryId: pu.subsidiaryId ?? scope.subsidiaryId,
        businessUnitId: pu.businessUnitId ?? scope.businessUnitId,
        category: pu.category || category,
        dueDate: pu.dueDate ?? pu.reportingPeriod?.submissionDeadline ?? new Date(now.getTime() + 14 * 86400000),
        values: JSON.stringify(values.length ? values : parseJsonArraySafe(pu.values)),
      },
    }).catch((e) => warn("enrich submission notice", e));

    // 2. Platform-side event trail (Group Admin console feed)
    const scopeLabel = scope.label || "Group";
    const portalLine = opts.phase === "RESUBMITTED" ? "Resubmitted" : "Submitted";
    await db.activityEvent.create({
      data: {
        actorName: opts.actorName,
        actorRole: `PORTAL:${opts.actorRole}`,
        action: opts.phase === "RESUBMITTED" ? "RESUBMIT" : "SUBMIT",
        targetType: "Submission",
        targetLabel: `${ref} — ${pu.title}`,
        orgLabel: scopeLabel,
        severity: "INFO",
      },
    }).catch(() => undefined);
    await db.auditEvent.create({
      data: {
        actorName: opts.actorName,
        actorRole: `PORTAL:${opts.actorRole}`,
        action: opts.phase === "RESUBMITTED" ? "SUBMISSION_RESUBMIT" : "SUBMISSION_CREATE",
        targetType: "Submission",
        targetId: pu.id,
        targetLabel: `${ref} — ${pu.title}`,
        orgScope: pu.project?.businessUnit?.subsidiary?.code ?? "GROUP",
        after: JSON.stringify({ status: pu.status, source: "PROJECT_PORTAL" }),
        outcome: "SUCCESS",
        correlation: `pu-${pu.id}`,
      },
    }).catch(() => undefined);

    // 3. Receiver-side bells: subsidiary-scoped notification for reviewers
    await db.notification.create({
      data: {
        ntype: "SUBMISSION",
        title: `Project site data received: ${ref}`,
        body: `${pu.title} — ${portalLine.toLowerCase()} from the Project User Portal by ${opts.actorName} (${opts.actorRole}) for ${scopeLabel}.`,
        severity: "INFO",
        linkView: "submissions",
        refId: pu.id,
        subsidiaryId: scope.subsidiaryId,
      },
    }).catch(() => undefined);

    // 4. Sender reflection: confirm the data entered the review chain
    await db.notification.create({
      data: {
        ntype: "SUBMISSION",
        title: `Sent for review: ${ref}`,
        body: `Your ${pu.module ?? "site"} data for ${pu.project?.name ?? "your site"} has entered the BU/Subsidiary review chain. You will be notified when a reviewer decides.`,
        severity: "INFO",
        linkView: "submissions",
        refId: pu.id,
      },
    }).catch(() => undefined);

    const evidenceNames = await mirrorEvidence(recordIds, ref, scopeLabel, opts.actorName);
    if (evidenceNames.length > 0) {
      const existing = parseJsonArraySafe(pu.evidence);
      const merged = Array.from(new Set([...existing.map(String), ...evidenceNames]));
      await db.submission.update({
        where: { id: pu.id },
        data: { evidence: JSON.stringify(merged) },
      }).catch(() => undefined);
    }

    log(`enriched ${ref} → platform scope (${scopeLabel}, evidence: ${evidenceNames.length})`);
    return { ok: true, mainSubmissionId: pu.id, mainRef: ref, scopeLabel };
  } catch (e) {
    warn("mirrorPuSubmission failed", e);
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/* ── INBOUND: platform decision → sender reflection ──────────────────────── */

export type BridgeDecision = "approve" | "reject" | "request_changes" | "return";

/** Portal approve ladder (mirrors the portal workflow APPROVE_SEQUENCE). */
const APPROVE_LADDER = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "BU_APPROVED", "SUBSIDIARY_APPROVED", "HQ_REVIEW",
] as const;

/**
 * Reflect a platform review decision back onto the shared submission +
 * notify the submitter (the receiver side of the loop). `level`:
 * "SUBSIDIARY" (Subsidiary Manager decided) or "GROUP" (Group Admin).
 */
export async function syncDecisionToPu(params: {
  mainRef: string;
  decision: BridgeDecision;
  level?: "SUBSIDIARY" | "GROUP";
  actorId?: string;
  actorName: string;
  actorRole: string;
  reason?: string;
}): Promise<{ ok: boolean; puSubmissionId?: string; puStatus?: string; hops?: string[]; reason?: string }> {
  const { mainRef, decision, actorName, actorRole } = params;
  if (!mainRef.startsWith("PU-")) return { ok: false, reason: "not a portal submission" };
  const puId = mainRef.slice(3);
  try {
    const pu = await db.submission.findUnique({ where: { id: puId } });
    if (!pu) return { ok: false, reason: "submission not found" };

    const { canTransition } = await import("@/lib/pu/workflow");

    const fromStatus = pu.status;
    let toStatus: string | null = null;
    const hops: string[] = [];

    if (decision === "approve") {
      const target = params.level === "GROUP" ? "APPROVED" : "SUBSIDIARY_APPROVED";
      if (fromStatus === target || fromStatus === "LOCKED") {
        toStatus = fromStatus; // already at/behind target — just record
      } else if (canTransition(fromStatus, target)) {
        toStatus = target;
        hops.push(target);
      } else {
        // Walk the ladder from the current state to the target, one hop at a time.
        const startIdx = APPROVE_LADDER.indexOf(fromStatus as (typeof APPROVE_LADDER)[number]);
        if (startIdx >= 0) {
          let cur = fromStatus;
          for (let i = startIdx + 1; i < APPROVE_LADDER.length; i++) {
            const next = APPROVE_LADDER[i];
            if (!canTransition(cur, next)) break;
            cur = next;
            hops.push(next);
            if (next === target) break;
            if (params.level === "SUBSIDIARY" && next === "SUBSIDIARY_APPROVED") break;
          }
          toStatus = cur !== fromStatus ? cur : null;
        }
      }
      if (!toStatus && fromStatus !== target) toStatus = canTransition(fromStatus, "APPROVED") ? "APPROVED" : fromStatus;
    } else {
      const candidates = ["CORRECTION_REQUESTED", "UNDER_REVIEW"];
      toStatus = candidates.find((c) => canTransition(fromStatus, c)) ?? null;
      if (toStatus) hops.push(toStatus);
    }

    if (toStatus && toStatus !== fromStatus) {
      await db.submission.update({
        where: { id: puId },
        data: {
          status: toStatus,
          reviewedAt: new Date(),
          reviewComment: params.reason || pu.reviewComment,
          ...(toStatus === "APPROVED" || toStatus === "LOCKED"
            ? { lockedAt: new Date(), lockedBy: params.actorId ?? (await ensurePuSystemUser()) }
            : {}),
        },
      });
    }

    // THE receiver reflection: the submitter sees the decision + reason
    await db.notification.create({
      data: {
        ntype: decision === "approve" ? "APPROVAL" : "DATA_QUALITY",
        title:
          decision === "approve"
            ? `Approved: ${pu.title}`
            : decision === "reject"
              ? `Changes required: ${pu.title}`
              : `Reviewer feedback: ${pu.title}`,
        body:
          decision === "approve"
            ? `Your submission was approved by ${actorName} (${actorRole}).${params.reason ? ` Note: ${params.reason.slice(0, 200)}` : ""}`
            : `${actorName} (${actorRole}) ${decision === "reject" ? "returned your submission for correction" : "recorded feedback"}.${params.reason ? ` Reason: ${params.reason.slice(0, 220)}` : ""}`,
        severity: decision === "approve" ? "SUCCESS" : "WARNING",
        linkView: "submissions",
        refId: puId,
      },
    }).catch(() => undefined);

    log(`decision ${decision} reflected to ${puId} (${fromStatus} → ${toStatus ?? "kept"}, hops: ${hops.join(">") || "none"})`);
    return { ok: true, puSubmissionId: puId, puStatus: toStatus ?? fromStatus, hops };
  } catch (e) {
    warn("syncDecisionToPu failed", e);
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/* ── TASKS: platform assignment → portal deadline notifications ─────────── */

const PORTAL_SITE_ROLES = [
  "ENV_DATA_USER", "FIN_RESOURCE_USER", "HR_USER", "EHS_USER",
  "PROCUREMENT_USER", "CSR_USER", "COMPLIANCE_USER", "ESG_ANALYST",
];

/**
 * Push a platform task into the portal: site-operations users whose project
 * / BU / subsidiary scope intersects the task receive a DEADLINE notification
 * with the due date — assign task + deadline is visible on the receiver side.
 */
export async function pushTaskToPortalUsers(task: {
  id: string;
  ref: string;
  title: string;
  description: string;
  category: string;
  dueDate: Date;
  priority: string;
  subsidiaryId: string | null;
  businessUnitId: string | null;
}): Promise<{ notified: number }> {
  try {
    // Projects inside the task's scope
    const projects = await db.project.findMany({
      where: {
        status: "ACTIVE",
        ...(task.businessUnitId
          ? { businessUnitId: task.businessUnitId }
          : task.subsidiaryId
            ? { businessUnit: { subsidiaryId: task.subsidiaryId } }
            : {}),
      },
      select: { id: true },
    });
    const targets = projects.map((p) => p.id);
    if (targets.length === 0) return { notified: 0 };

    // Site-operations users scoped to those projects
    const users = await db.user.findMany({
      where: { status: "ACTIVE", role: { in: PORTAL_SITE_ROLES }, projectId: { in: targets } },
      select: { id: true },
    });
    const dueLabel = task.dueDate.toISOString().slice(0, 10);
    for (const u of users) {
      await db.notification.create({
        data: {
          ntype: "DEADLINE",
          title: `New task: ${task.title}`,
          body: `${task.description || "ESG reporting task"} — due ${dueLabel} (priority ${task.priority}). Reference ${task.ref}.`,
          severity: task.priority === "CRITICAL" || task.priority === "HIGH" ? "WARNING" : "INFO",
          linkView: "dashboard",
          refId: task.id,
        },
      }).catch(() => undefined);
    }
    log(`task ${task.ref} pushed to ${users.length} site user(s) across ${targets.length} project(s)`);
    return { notified: users.length };
  } catch (e) {
    warn("pushTaskToPortalUsers failed", e);
    return { notified: 0 };
  }
}
