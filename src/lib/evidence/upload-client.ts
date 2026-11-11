/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Client upload helper (security aware)

   One place that talks to the evidence upload endpoints and normalises the
   two rejections the server can now return:

     • 422 MALWARE_DETECTED  — the file failed the security scan.
     • 409 DUPLICATE_EVIDENCE — the exact same bytes are already in the vault.

   Both carry enough detail for the UI to name the offending copy and offer
   the user a deliberate way forward, instead of a generic "upload failed".
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DuplicateInfo {
  duplicateId: string;
  fileName: string;
  uploaderName: string;
  createdAt: string;
}

export interface MalwareFinding {
  code: string;
  detail: string;
  layer: string;
}

export type UploadRejection =
  | { kind: "malware"; message: string; findings: MalwareFinding[] }
  | { kind: "duplicate"; message: string; duplicate: DuplicateInfo }
  | { kind: "error"; message: string };

export type UploadOutcome =
  | { ok: true; data: unknown }
  | { ok: false; rejection: UploadRejection };

export interface UploadEvidenceOptions {
  /** API base, e.g. "/api/pu" or "/api/so". */
  apiBase: string;
  file: File;
  /** Extra multipart fields (documentType, module, projectId, …). */
  fields?: Record<string, string | undefined>;
  /**
   * Set when the user has explicitly confirmed that re-uploading an already
   * stored file is intentional. The server then files it as a new version
   * instead of rejecting it.
   */
  allowDuplicate?: boolean;
}

/** POST a file to an evidence endpoint and classify the response. */
export async function uploadEvidenceFile({
  apiBase,
  file,
  fields,
  allowDuplicate,
}: UploadEvidenceOptions): Promise<UploadOutcome> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value !== undefined && value !== null && value !== "") fd.append(key, value);
  }
  if (allowDuplicate) fd.append("allowDuplicate", "true");

  let res: Response;
  try {
    res = await fetch(`${apiBase}/evidence`, { method: "POST", body: fd });
  } catch {
    return {
      ok: false,
      rejection: { kind: "error", message: "Network error — could not reach the server." },
    };
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (res.ok) return { ok: true, data };

  const message = typeof data.error === "string" ? data.error : `Upload failed (${res.status}).`;

  if (res.status === 422 || data.code === "MALWARE_DETECTED") {
    return {
      ok: false,
      rejection: {
        kind: "malware",
        message,
        findings: Array.isArray(data.findings) ? (data.findings as MalwareFinding[]) : [],
      },
    };
  }

  if (res.status === 409 || data.code === "DUPLICATE_EVIDENCE") {
    return {
      ok: false,
      rejection: {
        kind: "duplicate",
        message,
        duplicate: (data.duplicate as DuplicateInfo) ?? {
          duplicateId: "",
          fileName: file.name,
          uploaderName: "another user",
          createdAt: new Date().toISOString(),
        },
      },
    };
  }

  return { ok: false, rejection: { kind: "error", message } };
}
