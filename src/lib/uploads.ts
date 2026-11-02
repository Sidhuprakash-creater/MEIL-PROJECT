import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/* ═══════════════════════════════════════════════════════════════════════════
   Evidence file storage — shared by every console API family.

   Bytes are stored IN the database (EvidenceFile.data — SQLite BLOB today,
   Postgres bytea on Supabase tomorrow) so the exact same Prisma schema and
   code run on both engines with zero migration work in application code.

   Every console upload endpoint funnels through `storeEvidenceFile()`:
     · size + extension validation (10 MB cap)
     · EvidenceFile row (bytes) + EvidenceDoc row (repository metadata)
     · automatic version bump when the same document name is re-uploaded
       into the same submission (the "family" concept used by reviewers)
     · the linked Submission's evidence[] name list is kept in sync
   ═══════════════════════════════════════════════════════════════════════════ */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: "PDF",
  xlsx: "XLSX",
  xls: "XLSX",
  csv: "CSV",
  doc: "DOCX",
  docx: "DOCX",
  png: "IMAGE",
  jpg: "IMAGE",
  jpeg: "IMAGE",
  webp: "IMAGE",
  gif: "IMAGE",
};

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function classifyUpload(name: string, mime: string): { ext: string; fileType: string; mimeType: string } {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  const fileType = ALLOWED_EXTENSIONS[ext];
  if (!fileType) {
    throw new UploadError(
      `Unsupported file type ".${ext || "(none)"}". Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}.`,
      400
    );
  }
  return { ext, fileType, mimeType: mime || "application/octet-stream" };
}

export interface StoreEvidenceArgs {
  file: File;
  subsidiaryId: string;
  businessUnitId?: string | null;
  projectId?: string | null;
  submissionId?: string | null;
  disclosureRef?: string;
  uploadedBy: { id: string; name: string; role: string };
  /** Override the notification broadcast (per-console helpers usually do it). */
}

export interface StoredEvidence {
  fileId: string;
  docId: string;
  name: string;
  fileType: string;
  sizeKb: number;
  version: number;
  submissionRef: string;
}

/** Persist one uploaded file: bytes + repository metadata + submission sync. */
export async function storeEvidenceFile(args: StoreEvidenceArgs): Promise<StoredEvidence> {
  const { file } = args;
  if (!file || typeof file.name !== "string" || !file.name.trim()) {
    throw new UploadError("No file was provided.", 400);
  }
  const name = file.name.trim().slice(0, 160);
  const { fileType, mimeType } = classifyUpload(name, file.type);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength === 0) throw new UploadError("The selected file is empty.", 400);
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB upload limit.`, 413);
  }

  /* Resolve the submission (when linked) so metadata stays consistent. */
  let submissionRef = "";
  let subsidiaryId = args.subsidiaryId;
  let businessUnitId = args.businessUnitId ?? null;
  let projectId = args.projectId ?? null;
  if (args.submissionId) {
    const s = await db.submission.findUnique({
      where: { id: args.submissionId },
      select: { ref: true, subsidiaryId: true, businessUnitId: true, projectId: true, evidence: true },
    });
    if (!s) throw new UploadError("Linked submission was not found.", 404);
    submissionRef = s.ref;
    subsidiaryId = s.subsidiaryId ?? subsidiaryId;
    businessUnitId = s.businessUnitId ?? businessUnitId;
    projectId = s.projectId ?? projectId;
  }

  /* Version bump: same name re-uploaded into the same scope/submission. */
  const prior = await db.evidenceDoc.findFirst({
    where: {
      name,
      subsidiaryId,
      ...(args.submissionId ? { submissionId: args.submissionId } : {}),
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (prior?.version ?? 0) + 1;

  const stored = await db.evidenceFile.create({
    data: {
      name,
      mimeType,
      sizeBytes: buf.byteLength,
      data: buf,
      subsidiaryId,
      businessUnitId,
      projectId,
      submissionId: args.submissionId ?? null,
      uploadedById: args.uploadedBy.id,
      uploadedByName: args.uploadedBy.name,
      uploadedByRole: args.uploadedBy.role,
    },
  });

  const doc = await db.evidenceDoc.create({
    data: {
      name,
      fileType,
      mimeType,
      sizeKb: Math.max(1, Math.round(buf.byteLength / 1024)),
      version,
      fileId: stored.id,
      subsidiaryId,
      businessUnitId,
      projectId,
      submissionId: args.submissionId ?? null,
      submissionRef,
      disclosureRef: args.disclosureRef ?? "",
      uploadedBy: args.uploadedBy.name,
      uploadedById: args.uploadedBy.id,
      status: "VALID",
    },
  });

  /* Keep the linked submission's evidence[] name list in sync so every
     console that renders submission.evidence immediately shows the file. */
  if (args.submissionId) {
    const s = await db.submission.findUnique({
      where: { id: args.submissionId },
      select: { evidence: true, history: true },
    });
    if (s) {
      let names: string[] = [];
      try {
        const parsed = JSON.parse(s.evidence || "[]");
        if (Array.isArray(names = parsed)) names = names.map(String);
      } catch {
        names = [];
      }
      if (!names.includes(name)) names.push(name);
      let history: { action: string; actor: string; at: string; note?: string }[] = [];
      try {
        const parsed = JSON.parse(s.history || "[]");
        if (Array.isArray(parsed)) history = parsed;
      } catch {
        history = [];
      }
      history.push({
        action: `Evidence uploaded: ${name} (v${version})`,
        actor: args.uploadedBy.name,
        at: new Date().toISOString(),
      });
      await db.submission.update({
        where: { id: args.submissionId },
        data: { evidence: JSON.stringify(names), history: JSON.stringify(history) },
      });
    }
  }

  return {
    fileId: stored.id,
    docId: doc.id,
    name,
    fileType,
    sizeKb: doc.sizeKb,
    version,
    submissionRef,
  };
}

/**
 * Serve the real bytes for an EvidenceDoc (or EvidenceFile) id. Returns null
 * when the record has no stored bytes — callers fall back to the metadata
 * receipt so pre-existing demo rows keep working.
 */
export async function serveEvidenceBytes(
  fileId: string,
  downloadName: string
): Promise<NextResponse | null> {
  const f = await db.evidenceFile.findUnique({ where: { id: fileId } });
  if (!f) return null;
  const safeName = downloadName.replace(/[^\w.\-() ]+/g, "_") || "evidence";
  const body = new Uint8Array(f.data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": f.mimeType || "application/octet-stream",
      "Content-Length": String(f.sizeBytes),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Standard error mapping for upload endpoints that don't have their own. */
export function uploadErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof UploadError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return null;
}
