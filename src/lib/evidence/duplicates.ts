/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Evidence & record duplication detection

   Two flavours of duplicate, both keyed on content rather than on the file
   name (names are reused legitimately for different documents):

     • Evidence duplicates  — the exact same bytes were already stored.
       Matched on the SHA-256 of the file content.

     • Record duplicates    — the same *logical record* was captured twice,
                               e.g. the same energy reading for the same
                               project, period and source. Matched on the
                               business key (project + period + module +
                               source record) plus a normalised content
                               fingerprint, so a re-submission of identical
                               values is caught even when it was entered
                               rather than uploaded.

   The helper returns enough context for the UI to name the existing copy —
   who uploaded it, when, and where it lives — so a person can decide
   whether the duplicate is intentional.
   ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "@/lib/db";

/* ── Evidence duplicates (content hash) ───────────────────────────────────── */

export interface DuplicateEvidence {
  id: string;
  fileName: string;
  fileSize: number | null;
  hash: string | null;
  status: string;
  createdAt: Date;
  uploaderName: string;
  projectId: string | null;
  submissionId: string | null;
  submissionRef: string;
}

/**
 * Find an existing evidence row with the same content hash.
 *
 * `scope` narrows the search to the place the new file would land, so an
 * identical document filed against a different project is not flagged —
 * but an identical document in the same project still is.
 */
export async function findDuplicateEvidence(
  sha256: string,
  scope?: { projectId?: string | null; submissionId?: string | null }
): Promise<DuplicateEvidence | null> {
  if (!sha256) return null;

  const where: Record<string, unknown> = { hash: { contains: sha256 } };
  if (scope?.projectId) where.projectId = scope.projectId;
  if (scope?.submissionId) where.submissionId = scope.submissionId;

  const rows = await db.evidence.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      hash: true,
      status: true,
      createdAt: true,
      uploaderId: true,
      projectId: true,
      sourceRecordId: true,
    },
  });

  if (rows.length === 0) return null;

  // Resolve uploader names in one query rather than N.
  const uploaderIds = [...new Set(rows.map((r) => r.uploaderId))];
  const uploaders = await db.user.findMany({
    where: { id: { in: uploaderIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(uploaders.map((u) => [u.id, u.name]));

  const top = rows[0];
  return {
    id: top.id,
    fileName: top.fileName,
    fileSize: top.fileSize,
    hash: top.hash,
    status: top.status,
    createdAt: top.createdAt,
    uploaderName: nameById.get(top.uploaderId) ?? "Unknown uploader",
    projectId: top.projectId,
    submissionId: null,
    submissionRef: "",
  };
}

/** How many other copies of this content already exist. */
export async function countDuplicateEvidence(
  sha256: string,
  excludeId?: string
): Promise<number> {
  if (!sha256) return 0;
  return db.evidence.count({
    where: {
      hash: { contains: sha256 },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/* ── Record duplicates (business key + value fingerprint) ─────────────────── */

/**
 * Build a stable fingerprint for a captured record's values.
 *
 * Object keys are sorted and values are normalised to a canonical string so
 * that `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` — or `1` vs `"1"` vs `1.0` —
 * are recognised as the same content.
 */
export function fingerprintRecord(data: unknown): string {
  const canonical = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
    }
    if (typeof value === "boolean") return value ? "1" : "0";
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${canonical(v)}`);
      return `{${entries.join(";")}}`;
    }
    return String(value).trim().toLowerCase();
  };
  return canonical(data);
}

export interface DuplicateRecord {
  id: string;
  level: number | null;
  levelKey: string | null;
  levelName: string | null;
  module: string | null;
  status: string | null;
  enteredAt: string | null;
  enteredBy: string | null;
  projectId: string | null;
  reportingPeriodId: string | null;
}

/**
 * Find a previously captured *level record* with the same business key AND
 * the same values.
 *
 * The business key is (project, period, level, source). Within that key, an
 * identical value fingerprint means the same measurement was captured twice
 * — the classic double-entry that inflates reported totals.
 *
 * Level records live in the shared portal store (file + AppSetting blob),
 * not in a Prisma model, so this reads through the same accessor the rest of
 * the data-entry flow uses.
 */
export async function findDuplicateRecord(input: {
  projectId?: string | null;
  reportingPeriodId?: string | null;
  level?: number | null;
  levelKey?: string | null;
  data: unknown;
  excludeId?: string;
}): Promise<DuplicateRecord | null> {
  const { projectId, reportingPeriodId, level, levelKey, data, excludeId } = input;

  // Without a project + period the key is too weak to dedupe on safely.
  if (!projectId || !reportingPeriodId) return null;

  const { getLevelRecords } = await import("@/lib/pu/level-records");
  const rows = getLevelRecords(projectId, reportingPeriodId, level ?? undefined);

  if (rows.length === 0) return null;

  const target = fingerprintRecord(data);
  if (!target || target === "{}") return null;

  const match = rows.find(
    (r) => r.id !== excludeId && fingerprintRecord(r.data) === target,
  );
  if (!match) return null;

  return {
    id: match.id,
    level: match.level,
    levelKey: match.levelKey,
    levelName: match.levelName,
    module: match.module,
    status: match.status,
    enteredAt: match.enteredAt,
    enteredBy: match.enteredBy,
    projectId: match.projectId,
    reportingPeriodId: match.reportingPeriodId,
  };
}

/* ── User-facing messaging ───────────────────────────────────────────────── */

/** Human-friendly description of an evidence duplicate. */
export function describeEvidenceDuplicate(dup: DuplicateEvidence): string {
  const when = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dup.createdAt);
  const size = dup.fileSize ? ` (${(dup.fileSize / 1024).toFixed(0)} KB)` : "";
  return `This exact file was already uploaded as "${dup.fileName}"${size} by ${dup.uploaderName} on ${when}.`;
}

/** Human-friendly description of a record duplicate. */
export function describeRecordDuplicate(dup: DuplicateRecord): string {
  const when = dup.enteredAt
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dup.enteredAt))
    : "an earlier date";
  const source = dup.levelName ?? dup.levelKey ?? (dup.level ? `Level ${dup.level}` : "this record");
  return `Identical values were already recorded for "${source}" by ${dup.enteredBy ?? "another user"} on ${when}.`;
}
