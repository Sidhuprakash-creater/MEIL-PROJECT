import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "@/lib/db";
import { scanForMalware, summarizeScan } from "@/lib/evidence/security";
import { describeEvidenceDuplicate, findDuplicateEvidence } from "@/lib/evidence/duplicates";

/* ═══════════════════════════════════════════════════════════════════════════
   Evidence file storage — shared by every console API family.

   Bytes are stored ON DISK (`public/evidence-uploads/`) and indexed by the
   unified `Evidence` model (fileName + filePath + sha-256 hash), matching the
   portal's evidence vault. The EvidenceDoc row keeps the per-console
   repository metadata in sync.

   Every console upload endpoint funnels through `storeEvidenceFile()`:
     · size + extension validation (10 MB cap)
     · Evidence row (file on disk) + EvidenceDoc row (repository metadata)
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

/**
 * Raised when the uploaded content already exists in the vault. Carries the
 * details of the existing copy so the UI can name it for the user instead of
 * showing a generic failure.
 */
export class DuplicateUploadError extends UploadError {
  duplicate: {
    duplicateId: string;
    fileName: string;
    uploaderName: string;
    createdAt: string;
  };
  constructor(
    message: string,
    status: number,
    duplicate: DuplicateUploadError["duplicate"]
  ) {
    super(message, status);
    this.duplicate = duplicate;
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
  /**
   * Set when the user has explicitly confirmed that re-uploading an already
   * stored file is intentional (e.g. filing it against a different scope as a
   * new version). When false — the default — an identical file is rejected.
   */
  allowDuplicate?: boolean;
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

  const safeName = name.replace(/[^\w.\-() ]+/g, "_");
  const storedName = `${Date.now()}-${safeName}`;
  const filePath = `/evidence-uploads/${storedName}`;

  /* ── SECURITY GATE ────────────────────────────────────────────────────────
     Every byte that reaches disk passes the malware scanner first, and the
     content hash is checked against the vault so the same file cannot be
     filed twice under the same scope. Both checks run BEFORE anything is
     written, so a rejected file never leaves a trace on the server. */
  const scan = scanForMalware({ fileName: name, buffer: buf });
  if (!scan.clean) {
    const detail = summarizeScan(scan);
    throw new UploadError(
      `Upload blocked — the file failed the security scan. ${detail}`,
      422,
    );
  }

  const duplicate = await findDuplicateEvidence(scan.sha256, {
    projectId: args.projectId ?? projectId ?? null,
    submissionId: args.submissionId ?? null,
  });
  if (duplicate && !args.allowDuplicate) {
    throw new DuplicateUploadError(
      describeEvidenceDuplicate(duplicate),
      409,
      {
        duplicateId: duplicate.id,
        fileName: duplicate.fileName,
        uploaderName: duplicate.uploaderName,
        createdAt: duplicate.createdAt.toISOString(),
      },
    );
  }

  /* Store the bytes on disk (or /tmp on serverless environments like Vercel) … */
  try {
    const uploadDir = path.join(process.cwd(), "public", "evidence-uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, storedName), buf);
  } catch {
    try {
      const tmpDir = path.join(os.tmpdir(), "evidence-uploads");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, storedName), buf);
    } catch {}
  }

  /* … and index it with the unified Evidence model. */
  const hash = `sha256:${scan.sha256}`;
  const stored = await db.evidence.create({
    data: {
      fileName: name,
      documentType: "REGISTER",
      filePath,
      fileSize: buf.byteLength,
      mimeType,
      hash,
      projectId: projectId ?? null,
      reportingPeriodId: null,
      module: null,
      uploaderId: args.uploadedBy.id,
      status: "UPLOADED",
    },
  });

  /* Persist bytes in AppSetting so Vercel lambdas can serve it anytime */
  await db.appSetting.upsert({
    where: { skey: `evidence_blob:${stored.id}` },
    create: {
      skey: `evidence_blob:${stored.id}`,
      label: name,
      category: "EVIDENCE_BLOB",
      svalue: buf.toString("base64"),
      vtype: "text",
    },
    update: {
      svalue: buf.toString("base64"),
    },
  }).catch(() => null);

  await db.appSetting.upsert({
    where: { skey: `evidence_blob_file:${storedName}` },
    create: {
      skey: `evidence_blob_file:${storedName}`,
      label: name,
      category: "EVIDENCE_BLOB",
      svalue: buf.toString("base64"),
      vtype: "text",
    },
    update: {
      svalue: buf.toString("base64"),
    },
  }).catch(() => null);

  const doc = await db.evidenceDoc.create({
    data: {
      name,
      fileType,
      sizeKb: Math.max(1, Math.round(buf.byteLength / 1024)),
      version,
      subsidiaryId,
      businessUnitId,
      projectId,
      submissionId: args.submissionId ?? null,
      submissionRef,
      disclosureRef: args.disclosureRef ?? "",
      uploadedBy: args.uploadedBy.name,
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
 * Serve the real bytes for an Evidence (vault) id. Returns null when the
 * record or its file is missing — callers fall back to the metadata receipt
 * so pre-existing demo rows keep working.
 */
export async function serveEvidenceBytes(
  fileId: string,
  downloadName: string
): Promise<NextResponse | null> {
  const f = await db.evidence.findUnique({ where: { id: fileId } });
  if (!f || !f.filePath) return null;

  let buffer: Buffer | null = null;
  const abs = path.join(process.cwd(), "public", f.filePath.replace(/^\//, ""));
  if (fs.existsSync(abs)) {
    try { buffer = fs.readFileSync(abs); } catch {}
  }

  if (!buffer) {
    try {
      const tmpPath = path.join(os.tmpdir(), "evidence-uploads", path.basename(f.filePath));
      if (fs.existsSync(tmpPath)) {
        buffer = fs.readFileSync(tmpPath);
      }
    } catch {}
  }

  if (!buffer) {
    try {
      const blob = await db.appSetting.findFirst({
        where: {
          OR: [
            { skey: `evidence_blob:${f.id}` },
            { skey: `evidence_blob_file:${path.basename(f.filePath)}` },
          ],
        },
        select: { svalue: true },
      });
      if (blob?.svalue) {
        buffer = Buffer.from(blob.svalue, "base64");
      }
    } catch {}
  }

  if (!buffer) return null;

  const safeName = downloadName.replace(/[^\w.\-() ]+/g, "_") || "evidence";
  const body = new Uint8Array(buffer);
  return new NextResponse(body, {
    headers: {
      "Content-Type": f.mimeType || "application/octet-stream",
      "Content-Length": String(f.fileSize ?? body.byteLength),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Standard error mapping for upload endpoints that don't have their own. */
export function uploadErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof DuplicateUploadError) {
    return NextResponse.json(
      {
        error: e.message,
        code: "DUPLICATE_EVIDENCE",
        duplicate: e.duplicate,
      },
      { status: e.status },
    );
  }
  if (e instanceof UploadError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return null;
}
